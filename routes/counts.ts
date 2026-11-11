// Like and repost counts for the site's own posts, for pages that show them
// without the counts written in (a prerendered page, say, whose counts would
// otherwise be as old as the build):
//   ?uri=<at:// URI>&uri=… (at most 25)
// Answers { posts: { [uri]: { likes, reposts } } }. From Bluesky's public API,
// remembered for 2 minutes, so readers' browsers never contact Bluesky.
import type { APIRoute } from "astro";
import { addressOf, json, rateLimit } from "../lib/http";
import { isSitePost } from "../lib/uris";

const APPVIEW = "https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts";
const MAX_URIS = 25;
const CACHE_MS = 2 * 60 * 1000;
const MAX_CACHED = 500;

type Counts = { likes: number; reposts: number };
const cache = new Map<string, { counts: Counts; at: number }>();

const perAddress = rateLimit(30, 300);
const overall = rateLimit(300, 6000);

export const GET: APIRoute = async (context) => {
  const uris = [...new Set(context.url.searchParams.getAll("uri"))];
  if (!uris.length) return json({ posts: {} });
  if (uris.length > MAX_URIS) return json({ error: "too-many-posts" }, 400);
  if (!uris.every(isSitePost)) return json({ error: "not-allowed" }, 400);

  const posts: Record<string, Counts> = {};
  const now = Date.now();
  const missing: string[] = [];
  for (const uri of uris) {
    const cached = cache.get(uri);
    if (cached && now - cached.at < CACHE_MS) posts[uri] = cached.counts;
    else missing.push(uri);
  }
  if (!missing.length) return json({ posts });

  if (perAddress(addressOf(context)) || overall("all")) return json({ error: "too-many" }, 429);
  try {
    const url = new URL(APPVIEW);
    for (const uri of missing) url.searchParams.append("uris", uri);
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`getPosts ${response.status}`);
    const found = ((await response.json()) as { posts?: { uri: string; likeCount?: number; repostCount?: number }[] }).posts ?? [];
    for (const post of found) {
      const counts = { likes: post.likeCount ?? 0, reposts: post.repostCount ?? 0 };
      posts[post.uri] = counts;
      if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
      cache.set(post.uri, { counts, at: now });
    }
    return json({ posts });
  } catch {
    // Whatever was remembered, however old, is better than nothing.
    for (const uri of missing) {
      const stale = cache.get(uri);
      if (stale) posts[uri] = stale.counts;
    }
    return Object.keys(posts).length ? json({ posts }) : json({ error: "unavailable" }, 502);
  }
};
