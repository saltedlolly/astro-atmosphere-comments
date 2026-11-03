// Likes or reposts a post (the site's announcement, or a comment under it) as
// the signed-in reader, or takes that back.
// Body: { post, kind: "like" | "repost", on: boolean }.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { createRecord, deleteRecord, inSiteThread, isPostUri, isSitePost, postsAsReader, rateLimit, reader } from "../lib/reader";
import { forgetThread } from "../lib/thread";

const tooMany = rateLimit(20, 120);
const COLLECTIONS = { like: "app.bsky.feed.like", repost: "app.bsky.feed.repost" } as const;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const signedIn = await reader(request, url, cookies);
  if (signedIn instanceof Response) return signedIn;

  let body: { post?: unknown; kind?: unknown; on?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  const { post, kind, on } = body;
  if (!isPostUri(post) || (kind !== "like" && kind !== "repost") || typeof on !== "boolean") {
    return json({ error: "bad-request" }, 400);
  }
  if (tooMany(signedIn.did)) return json({ error: "too-many" }, 429);

  try {
    const [view] = await postsAsReader(signedIn.session, [post]);
    if (!view) return json({ error: "not-found" }, 404);
    if (!inSiteThread(view)) return json({ error: "not-allowed" }, 400);
    const existing = kind === "like" ? view.viewer?.like : view.viewer?.repost;
    if (on && !existing) {
      await createRecord(signedIn, COLLECTIONS[kind], {
        $type: COLLECTIONS[kind],
        subject: { uri: view.uri, cid: view.cid },
        createdAt: new Date().toISOString(),
      });
    } else if (!on && existing) {
      await deleteRecord(signedIn, existing);
    }
    forgetThread(isSitePost(view.uri) ? view.uri : (view.record?.reply?.root?.uri ?? ""));
    return json({ kind, on });
  } catch (error) {
    console.warn(`[atmosphere] ${kind} failed:`, error instanceof Error ? error.message : error);
    return json({ error: "post-failed" }, 502);
  }
};
