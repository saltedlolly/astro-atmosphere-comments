// Deletes one of the signed-in reader's own comments: a post of theirs that
// is a reply somewhere under one of the site's announcements. Nothing else,
// even though the permission behind it covers all of the reader's posts.
// Body: { post }. Readers who haven't allowed deleting yet get
// "needs-permission", and the page offers to ask their account host for it.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { allows, deleteRecord, isPostUri, isSitePost, postsAsReader, rateLimit, reader } from "../lib/reader";
import { forgetThread } from "../lib/thread";

const tooMany = rateLimit(10, 60);

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const signedIn = await reader(request, url, cookies);
  if (signedIn instanceof Response) return signedIn;

  let body: { post?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  const { post } = body;
  if (!isPostUri(post) || !post.startsWith(`at://${signedIn.did}/`)) return json({ error: "not-allowed" }, 400);
  if (!allows(signedIn, "app.bsky.feed.post", "delete")) return json({ error: "needs-permission" }, 403);
  if (tooMany(signedIn.did)) return json({ error: "too-many" }, 429);

  try {
    const [view] = await postsAsReader(signedIn.session, [post]);
    if (!view) return json({ error: "not-found" }, 404);
    // Only a reply under one of the site's announcements, never a post of its own.
    const root = view.record?.reply?.root?.uri;
    if (!isSitePost(root)) return json({ error: "not-allowed" }, 400);
    await deleteRecord(signedIn, view.uri);
    forgetThread(root);
    return json({ deleted: view.uri });
  } catch (error) {
    console.warn("[atmosphere] delete failed:", error instanceof Error ? error.message : error);
    return json({ error: "post-failed" }, 502);
  }
};
