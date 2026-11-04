// The comment thread for the page, as JSON for the comment box:
//   ?post=<at:// URI or bsky.app address of the announcement>, or
//   ?document=<at:// URI of the page's Standard.site record>, whose
//   bskyPostRef names the announcement.
// Only threads started by the site's own accounts are served.
//
// POST { root } forgets the cached copy of a thread, so a comment the
// reader's browser has just posted shows when the page is next loaded.
import type { APIRoute } from "astro";
import { addressOf, fromThisSite, json, rateLimit } from "../lib/http";
import { isSitePost } from "../lib/uris";
import { announcementFromDocument, postUriFromUrl } from "../lib/resolve";
import { forgetThread, getThread } from "../lib/thread";

const perAddress = rateLimit(10, 100);

export const GET: APIRoute = async ({ url }) => {
  const post = url.searchParams.get("post");
  const document = url.searchParams.get("document");
  let uri: string | null = null;
  try {
    if (post?.startsWith("at://")) uri = post;
    else if (post) uri = await postUriFromUrl(post);
    else if (document) uri = await announcementFromDocument(document);
  } catch {
    return json({ error: "unavailable" }, 502);
  }
  if (!uri) return json({ thread: null });
  if (!isSitePost(uri)) return json({ error: "not-allowed" }, 400);
  const thread = await getThread(uri);
  return thread ? json({ thread }) : json({ error: "unavailable" }, 502);
};

export const POST: APIRoute = async (context) => {
  const { request, url } = context;
  if (!fromThisSite(request, url)) return json({ error: "forbidden" }, 403);
  let root: unknown;
  try {
    ({ root } = await request.json());
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  if (!isSitePost(root)) return json({ error: "not-allowed" }, 400);
  if (perAddress(addressOf(context))) return json({ error: "too-many" }, 429);
  forgetThread(root);
  return json({ ok: true });
};
