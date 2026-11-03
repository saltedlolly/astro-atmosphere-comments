// The AT Protocol OAuth client: how this site asks a reader's account host for
// permission to post comments on their behalf.
//
// - Live, the site is a "confidential client": account hosts read its
//   client-metadata.json, and it proves who it is with a private key
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

// Only what commenting needs: create (and delete again) posts, likes and
// reposts, and read posts as the reader sees them (to know whether they've
// already liked or reposted), through Bluesky's AppView.
export const SCOPE = [
  "atproto",
  "repo:app.bsky.feed.post?action=create&action=delete",
  "repo:app.bsky.feed.like?action=create&action=delete",
  "repo:app.bsky.feed.repost?action=create&action=delete",
  "rpc:app.bsky.feed.getPosts?aud=did:web:api.bsky.app%23bsky_appview",
].join(" ");

const KEY_ID = "atmosphere-comments-1";

export const callbackPath = `${settings.base}/callback`;

export function clientMetadata() {
  return {
    client_id: `${settings.site}${settings.base}/client-metadata.json`,
    client_name: settings.clientName,
    client_uri: settings.site,
    ...(settings.logoUri && { logo_uri: settings.logoUri }),
    ...(settings.policyUri && { policy_uri: settings.policyUri }),
    ...(settings.tosUri && { tos_uri: settings.tosUri }),
    redirect_uris: [`${settings.site}${callbackPath}`] as [string],
    scope: SCOPE,
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
          scope: SCOPE,
          redirect_uris: [`${local.origin}${callbackPath}`],
        }),
      });
    }
    return new NodeOAuthClient({ ...common, clientMetadata: clientMetadata(), keyset: [await privateKey()] });
  })();
  return clientPromise;
}
