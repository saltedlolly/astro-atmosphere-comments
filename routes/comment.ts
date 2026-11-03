// Posts as the signed-in reader, to their own account:
// - a comment: a reply to the post's announcement (`root`), or to one of the
//   comments under it (`parent`);
// - a quote post (`quote: true`): their own post quoting the announcement.
import { AtpAgent, RichText } from "@atproto/api";
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { profileFor, publicProfile } from "../lib/profile";
import { createRecord, isPostUri, isSitePost, postsAsReader, rateLimit, reader } from "../lib/reader";
import { forgetThread } from "../lib/thread";

const MAX_GRAPHEMES = 300; // Bluesky's limit for a post

const tooMany = rateLimit(5, 30);
const publicAgent = new AtpAgent({ service: "https://public.api.bsky.app" });
const graphemes = new Intl.Segmenter();

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const signedIn = await reader(request, url, cookies);
  if (signedIn instanceof Response) return signedIn;

  let body: { text?: unknown; root?: unknown; parent?: unknown; quote?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const length = [...graphemes.segment(text)].length;
  if (!length) return json({ error: "empty" }, 400);
  if (length > MAX_GRAPHEMES) return json({ error: "too-long" }, 400);

  // Only this site's own announcements (and comments under them) can be
  // replied to or quoted from here.
  const root = body.root;
  if (!isSitePost(root)) return json({ error: "not-allowed" }, 400);
  const quote = body.quote === true;
  const parent = !quote && body.parent !== undefined && body.parent !== root ? body.parent : undefined;
  if (parent !== undefined && !isPostUri(parent)) return json({ error: "not-allowed" }, 400);

  if (tooMany(signedIn.did)) return json({ error: "too-many" }, 429);

  let posts;
  try {
    posts = await postsAsReader(signedIn.session, parent ? [root, parent] : [root]);
  } catch {
    return json({ error: "unavailable" }, 502);
  }
  const rootPost = posts.find((post) => post.uri === root);
  const parentPost = parent ? posts.find((post) => post.uri === parent) : rootPost;
  if (!rootPost || !parentPost) return json({ error: "not-found" }, 404);
  // A comment being replied to must belong to this announcement's thread.
  if (parent && parentPost.record?.reply?.root?.uri !== root) return json({ error: "not-allowed" }, 400);

  // Links, @mentions and #tags become proper links, as in the Bluesky app.
  const richText = new RichText({ text });
  try {
    await richText.detectFacets(publicAgent);
  } catch {
    richText.detectFacetsWithoutResolution();
  }

  const record = {
    $type: "app.bsky.feed.post",
    text: richText.text,
    ...(richText.facets?.length && { facets: richText.facets }),
    ...(quote
      ? { embed: { $type: "app.bsky.embed.record", record: { uri: rootPost.uri, cid: rootPost.cid } } }
      : {
          reply: {
            root: { uri: rootPost.uri, cid: rootPost.cid },
            parent: { uri: parentPost.uri, cid: parentPost.cid },
          },
        }),
    createdAt: new Date().toISOString(),
  };

  let created;
  try {
    created = await createRecord(signedIn, "app.bsky.feed.post", record);
  } catch (error) {
    console.warn("[atmosphere] post failed:", error instanceof Error ? error.message : error);
    return json({ error: "post-failed" }, 502);
  }
  forgetThread(root);
  const profile = await profileFor(signedIn.did);
  return json({
    uri: created.uri,
    url: `https://bsky.app/profile/${profile.handle}/post/${created.uri.split("/").pop()}`,
    text: richText.text,
    author: publicProfile(profile),
    createdAt: record.createdAt,
    quote,
    parent: parent ?? null,
  });
};
