// Whether the signed-in reader has liked or reposted the announcement and the
// comments under it, so the buttons start in the right state.
// ?post=<uri>&post=<uri>… (at most 100); posts outside the site's threads
// are left out of the answer.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { inSiteThread, isPostUri, postsAsReader, reader } from "../lib/reader";

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const uris = [...new Set(url.searchParams.getAll("post"))].filter(isPostUri).slice(0, 100);
  if (!uris.length) return json({ error: "bad-request" }, 400);
  const signedIn = await reader(request, url, cookies);
  if (signedIn instanceof Response) return signedIn;
  try {
    const views = await postsAsReader(signedIn.session, uris);
    const posts: Record<string, { liked: boolean; reposted: boolean }> = {};
    for (const view of views) {
      if (inSiteThread(view)) posts[view.uri] = { liked: !!view.viewer?.like, reposted: !!view.viewer?.repost };
    }
    return json({ posts });
  } catch {
    return json({ error: "unavailable" }, 502);
  }
};
