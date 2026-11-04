// The AT Protocol OAuth client: how this site asks a reader's account host for
// permission to post comments on their behalf.
//
// - Live, the site is a "confidential client": account hosts read its
//   /oauth-client-metadata.json, and it proves who it is with a private key
//   (ATMOSPHERE_PRIVATE_JWK, server-only). Sign-ins can then last for months.
// - In `astro dev`, it uses the protocol's local-testing client (no key, no
//   public address needed). Open the site at http://127.0.0.1:<port>, not
//   localhost, because the host sends readers back to that address.
import { requestLocalLock } from "@atproto/oauth-client";
import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  NodeOAuthClient,
  type NodeSavedSession,
  type NodeSavedState,
} from "@atproto/oauth-client-node";
import { getSecret } from "astro:env/server";
import settings from "./settings";
import { fileStore } from "./store";

// Only what commenting needs: create posts, create (and delete again) likes
// and reposts, and read posts as the reader sees them (to know whether they've
// already liked or reposted), through Bluesky's AppView.
export const SCOPE = [
  "atproto",
  "repo:app.bsky.feed.post?action=create",
  "repo:app.bsky.feed.like?action=create&action=delete",
  "repo:app.bsky.feed.repost?action=create&action=delete",
  "rpc:app.bsky.feed.getPosts?aud=did:web:api.bsky.app%23bsky_appview",
].join(" ");

// Deleting posts is asked for separately, only when a reader first deletes a
// comment here, so most readers never grant it. (A permission can only name a
// kind of record, not particular posts: the delete route itself makes sure it
// is only used on the reader's own comments under the site's posts.)
export const DELETE_SCOPE = "repo:app.bsky.feed.post?action=delete";

// Following (and unfollowing) the site's own accounts is asked for the same
// way, the first time a reader presses Follow.
export const FOLLOW_SCOPE = "repo:app.bsky.graph.follow?action=create&action=delete";

// Everything the site may ask for, which its client metadata has to list.
const ALL_SCOPES = `${SCOPE} ${DELETE_SCOPE} ${FOLLOW_SCOPE}`;

const KEY_ID = "atmosphere-comments-1";

export const callbackPath = `${settings.base}/callback`;

export function clientMetadata() {
  return {
    // At the site's root, the address account hosts treat as the convention:
    // Bluesky's approval page then shows just the site's address.
    client_id: `${settings.site}/oauth-client-metadata.json`,
    client_name: settings.clientName,
    client_uri: settings.site,
    ...(settings.logoUri && { logo_uri: settings.logoUri }),
    ...(settings.policyUri && { policy_uri: settings.policyUri }),
    ...(settings.tosUri && { tos_uri: settings.tosUri }),
    redirect_uris: [`${settings.site}${callbackPath}`] as [string],
    scope: ALL_SCOPES,
    grant_types: ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
    response_types: ["code"] as ["code"],
    application_type: "web" as const,
    token_endpoint_auth_method: "private_key_jwt" as const,
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks_uri: `${settings.site}${settings.base}/jwks.json`,
  };
}

let keyPromise: Promise<JoseKey> | undefined;

export function privateKey(): Promise<JoseKey> {
  keyPromise ??= (async () => {
    const jwk = getSecret("ATMOSPHERE_PRIVATE_JWK");
    if (!jwk) throw new Error("ATMOSPHERE_PRIVATE_JWK is not set");
    return JoseKey.fromImportable(jwk, KEY_ID);
  })();
  return keyPromise;
}

const stores = {
  // A sign-in in progress: kept for an hour at most.
  state: fileStore<NodeSavedState>("oauth-state", 60 * 60 * 1000),
  // Each reader's tokens, by their DID.
  session: fileStore<NodeSavedSession>("oauth-sessions"),
};

let clientPromise: Promise<NodeOAuthClient> | undefined;

/** The OAuth client. `origin` is only used in `astro dev`, for the local callback address. */
export function oauthClient(origin: string): Promise<NodeOAuthClient> {
  clientPromise ??= (async () => {
    const common = { stateStore: stores.state, sessionStore: stores.session, requestLock: requestLocalLock };
    if (import.meta.env.DEV) {
      const local = new URL(origin);
      local.hostname = "127.0.0.1";
      return new NodeOAuthClient({
        ...common,
        clientMetadata: buildAtprotoLoopbackClientMetadata({
          scope: ALL_SCOPES,
          redirect_uris: [`${local.origin}${callbackPath}`],
        }),
      });
    }
    return new NodeOAuthClient({ ...common, clientMetadata: clientMetadata(), keyset: [await privateKey()] });
  })();
  return clientPromise;
}
