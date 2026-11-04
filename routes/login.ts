// Starts signing in: the reader typed their handle (or DID) into the comment
// box. Their own account host is found from it, and they are sent there to
// approve this site's request to post comments for them.
import type { APIRoute } from "astro";
import { safeReturnPath, withStatus } from "../lib/http";
import { DELETE_SCOPE, FOLLOW_SCOPE, oauthClient, SCOPE } from "../lib/oauth";
import { signedInDid } from "../lib/visitor";

// The extra permissions a reader can add: deleting their comments, following.
const EXTRA_SCOPES: Record<string, string> = { delete: DELETE_SCOPE, follow: FOLLOW_SCOPE };

export const POST: APIRoute = async ({ request, url, redirect, cookies }) => {
  const form = await request.formData();
  const returnTo = safeReturnPath(form.get("returnTo"));
  const handle = String(form.get("handle") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!handle || handle.length > 253 || !/^(did:[a-z0-9:._%-]+|[a-z0-9.-]+\.[a-z0-9-]+)$/.test(handle)) {
    return redirect(withStatus(returnTo, "invalid-handle"), 303);
  }

  try {
    const client = await oauthClient(url.origin);
    // A new approval replaces the old one, so keep any extra permission the
    // reader already gave (asking to follow mustn't take away deleting).
    const extras = new Set<string>();
    const wanted = String(form.get("permission") ?? "");
    if (EXTRA_SCOPES[wanted]) extras.add(EXTRA_SCOPES[wanted]);
    const did = await signedInDid(cookies);
    if (did) {
      try {
        const granted = (await (await client.restore(did, false)).getTokenInfo(false)).scope.split(" ").map((scope) => {
          const [name, query = ""] = scope.split("?");
          return { name, actions: new URLSearchParams(query).getAll("action") };
        });
        // As in allows() (lib/reader.ts): no actions listed means all of them.
        const has = (collection: string, action: string) =>
          granted.some(({ name, actions }) => (name === `repo:${collection}` || name === "repo:*") && (!actions.length || actions.includes(action)));
        if (has("app.bsky.feed.post", "delete")) extras.add(DELETE_SCOPE);
        if (has("app.bsky.graph.follow", "create")) extras.add(FOLLOW_SCOPE);
      } catch {
        // Not signed in any more: just what's asked for.
      }
    }
    const authorizeUrl = await client.authorize(handle, {
      // The page sends readers back here with permission=delete or =follow
      // the first time they delete a comment or follow, if they haven't
      // allowed that yet.
      scope: [SCOPE, ...extras].join(" "),
      state: JSON.stringify({ returnTo }),
    });
    return redirect(authorizeUrl.href, 303);
  } catch (error) {
    console.warn("[atmosphere] sign-in could not start:", error instanceof Error ? error.message : error);
    return redirect(withStatus(returnTo, "account-not-found"), 303);
  }
};
