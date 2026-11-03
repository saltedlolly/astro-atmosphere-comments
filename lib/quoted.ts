// One of the site's announcements as Bluesky shows it (wording, author, link
// card), for the Quote preview. From Bluesky's public API, cached 10 minutes.
import { profileFor, type Profile } from "./profile";

export type Quoted = {
  author: Profile;
  text: string;
  external?: { uri: string; title: string; description: string; thumbSource?: string };
};

const cache = new Map<string, { quoted: Quoted; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

export async function quotedPost(uri: string): Promise<Quoted | null> {
  const cached = cache.get(uri);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.quoted;
  const response = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(uri)}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (!response.ok) throw new Error(`getPosts ${response.status}`);
  const [post] = ((await response.json()) as {
    posts?: {
      author: { did: string };
      record: { text?: string };
      embed?: { external?: { uri: string; title: string; description: string; thumb?: string } };
    }[];
  }).posts ?? [];
  if (!post) return null;
  const external = post.embed?.external;
  const quoted: Quoted = {
    author: await profileFor(post.author.did),
    text: post.record.text ?? "",
    ...(external && {
      external: {
        uri: external.uri,
        title: external.title,
        description: external.description,
        thumbSource: external.thumb,
      },
    }),
  };
  if (cache.size > 200) cache.clear();
  cache.set(uri, { quoted, at: Date.now() });
  return quoted;
}
