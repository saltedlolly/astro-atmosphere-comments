// The comment thread for the page, as JSON for the comment box:
//   ?post=<at:// URI or bsky.app address of the announcement>, or
//   ?document=<at:// URI of the page's Standard.site record>, whose
//   bskyPostRef names the announcement.
// Only threads started by the site's own accounts are served.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { isSitePost } from "../lib/reader";
import { announcementFromDocument, postUriFromUrl } from "../lib/resolve";
import { getThread } from "../lib/thread";

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
