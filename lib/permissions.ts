// What a reader's account host is asked to allow, and the site's OAuth
// client metadata. Shared by the server (routes/client-metadata.json.ts) and
// the browser (lib/client/account.ts), so both always agree.
//
// The site is a browser ("public") client: a reader's sign-in is kept only in
// their own browser, and the site's server never sees it. Signing out cancels
// it at the reader's account host.

// What every signed-in reader grants: their identity, and reading posts as
// they see them (to know whether they've already liked or reposted),
// through Bluesky's AppView. Nothing here can change their account.
export const BASE_SCOPE = "atproto rpc:app.bsky.feed.getPosts?aud=did:web:api.bsky.app%23bsky_appview";

// Everything else comes in groups. Signing in asks for all that a reader can
// do here at once (DEFAULT_PERMISSIONS), so there's one approval rather than
// a trip to their account host for each new thing: as the sign-in stays in
// their browser, the server can't use any of it, and the page's own code has
// the same reach either way. (A permission can only name a kind of record,
// not particular posts, so lib/client/account.ts limits each one to the
// site's own threads.)
export const PERMISSIONS = {
  // Comments, replies and quote posts.
  post: "repo:app.bsky.feed.post?action=create",
  // Likes and reposts, and taking them back.
  react: "repo:app.bsky.feed.like?action=create&action=delete repo:app.bsky.feed.repost?action=create&action=delete",
  // Deleting the reader's own comments.
  delete: "repo:app.bsky.feed.post?action=delete",
  // Following (and unfollowing) the site's own accounts.
  follow: "repo:app.bsky.graph.follow?action=create&action=delete",
  // For the site's own accounts: hiding comments under their announcements.
  moderate: "repo:app.bsky.feed.threadgate?action=create&action=update",
  // With the `standardSite` option: subscribing to the site's publication and
  // recommending its posts (Standard.site's own permission set, which account
  // hosts show as one line).
  social: "include:site.standard.authSocial",
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const isPermission = (value: unknown): value is Permission =>
  typeof value === "string" && Object.hasOwn(PERMISSIONS, value);

// What signing in asks for: everything readers can do here. "moderate" is
// added only for the site's own accounts (allowedAuthors), the only ones
// that can use it, and "social" only for sites with the `standardSite` option.
// Sign-ins from before a group was added are asked for it when it's first
// needed; those from before "social" sign in again instead (account.ts).
export const DEFAULT_PERMISSIONS: Permission[] = ["post", "react", "delete", "follow"];

/** The scope to ask for: the base, plus the groups named. */
export const scopeFor = (permissions: Iterable<Permission>) =>
  [BASE_SCOPE, ...new Set([...permissions].map((name) => PERMISSIONS[name]))].join(" ");

// Everything the site may ask for, which its client metadata has to list.
export const allScopes = (settings: { standardSite?: unknown }) =>
  scopeFor((Object.keys(PERMISSIONS) as Permission[]).filter((name) => name !== "social" || !!settings.standardSite));

// What Standard.site's permission set covers (its lexicon lists both).
const SOCIAL_COLLECTIONS = ["site.standard.graph.subscription", "site.standard.graph.recommend"];

/**
 * Whether `scopes` (a grant) allow `action` on records of `collection`: a
 * repo permission for that collection (or all of them) listing the action,
 * or listing no actions, which means all of them. A host may keep the
 * permission set's name in the grant, or write it out as repo permissions.
 */
export function scopesAllow(scopes: string[], collection: string, action: string): boolean {
  return scopes.some((scope) => {
    const [name, query = ""] = scope.split("?");
    if (name === PERMISSIONS.social) return SOCIAL_COLLECTIONS.includes(collection);
    const params = new URLSearchParams(query);
    const listed = name === "repo" && params.getAll("collection").some((item) => item === collection || item === "*");
    if (name !== `repo:${collection}` && name !== "repo:*" && !listed) return false;
    const actions = params.getAll("action");
    return !actions.length || actions.includes(action);
  });
}

/** The permission groups a grant covers in full. */
export function grantedPermissions(scopes: string[]): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((name) =>
    PERMISSIONS[name].split(" ").every((part) => {
      if (part === PERMISSIONS.social) {
        return SOCIAL_COLLECTIONS.every((collection) => ["create", "delete"].every((action) => scopesAllow(scopes, collection, action)));
      }
      const [scope, query = ""] = part.split("?");
      const collection = scope.replace(/^repo:/, "");
      return new URLSearchParams(query).getAll("action").every((action) => scopesAllow(scopes, collection, action));
    }),
  );
}

/** Whether a grant has BASE_SCOPE (compared by name, as hosts may write the rest differently). */
export function hasBase(scopes: string[]): boolean {
  const names = scopes.map((part) => part.split("?")[0]);
  return BASE_SCOPE.split(" ").every((part) => names.includes(part.split("?")[0]));
}

type MetadataSettings = {
  site: string;
  base: string;
  clientName: string;
  logoUri?: string;
  policyUri?: string;
  tosUri?: string;
  standardSite?: { publication: string; feed?: string };
};

export const callbackPath = (base: string) => `${base}/callback`;

/** The client metadata, served at /oauth-client-metadata.json (the site's client ID). */
export function clientMetadata(settings: MetadataSettings) {
  return {
    // At the site's root, the address account hosts treat as the convention:
    // Bluesky's approval page then shows just the site's address.
    client_id: `${settings.site}/oauth-client-metadata.json`,
    client_name: settings.clientName,
    client_uri: settings.site,
    ...(settings.logoUri && { logo_uri: settings.logoUri }),
    ...(settings.policyUri && { policy_uri: settings.policyUri }),
    ...(settings.tosUri && { tos_uri: settings.tosUri }),
    redirect_uris: [`${settings.site}${callbackPath(settings.base)}`] as [`https://${string}`],
    scope: allScopes(settings),
    grant_types: ["authorization_code", "refresh_token"] as ["authorization_code", "refresh_token"],
    response_types: ["code"] as ["code"],
    application_type: "web" as const,
    // A browser client: it has no secret to prove who it is, and its
    // tokens only work together with a key kept in the reader's browser.
    token_endpoint_auth_method: "none" as const,
    dpop_bound_access_tokens: true,
  };
}
