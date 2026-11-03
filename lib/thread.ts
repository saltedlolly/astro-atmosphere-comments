// The Bluesky thread under an announcement, read from Bluesky's public API:
// who liked and reposted it, and the replies (the comments), nested.
//
// Left out: replies the announcement's author hid (Bluesky's threadgate),
// deleted or blocked posts, posts or accounts carrying hiding labels from
// Bluesky's moderation (spam, porn…), and anything in the `hidden` option.
// Cached for two minutes per announcement; if Bluesky can't be reached the
// last good copy is kept.
import { rememberAvatar } from "./avatars";
import { segments, type Facet, type Segment } from "./richtext";
import settings from "./settings";

const APPVIEW = "https://public.api.bsky.app/xrpc/";
const CACHE_MS = 2 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 1000;
const MAX_CACHED = 200;
const MAX_DEPTH = 6;
const MAX_FACES = 48;
const HIDING_LABELS = new Set(["!hide", "!takedown", "!suspend", "spam", "porn", "sexual", "nudity", "graphic-media", "gore"]);

export type Person = { did: string; handle: string; displayName?: string; avatar?: string; url: string };

export type Reply = {
  uri: string;
  url: string;
  author: Person;
  /** Written by one of the site's own accounts. */
  byAuthor: boolean;
  createdAt: string;
  text: Segment[];
  /** 0 for a comment on the post, 1 for a reply to that, and so on. */
  depth: number;
  likeCount: number;
  repostCount: number;
};

export type Thread = {
  uri: string;
  url: string;
  likeCount: number;
  repostCount: number;
  likes: Person[];
  reposts: Person[];
  /** In reading order: each comment is followed by the replies to it. */
  replies: Reply[];
};

type Author = { did?: string; handle?: string; displayName?: string; avatar?: string; labels?: { val?: string }[] };
type ThreadPost = {
  uri?: string;
  author?: Author;
  record?: { text?: string; createdAt?: string; facets?: Facet[] };
  likeCount?: number;
  repostCount?: number;
  labels?: { val?: string }[];
};
type ThreadNode = { $type?: string; post?: ThreadPost; replies?: ThreadNode[] };

const normalise = (value: string) => value.trim().replace(/^@/, "").replace(/\/+$/, "").toLowerCase();
const hidden = new Set((settings.hidden ?? []).map(normalise));

async function call<T>(method: string, params: Record<string, string>): Promise<T> {
  const url = new URL(method, APPVIEW);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${method} returned ${response.status}`);
  return (await response.json()) as T;
}

function person(author: Author): Person | null {
  if (!author.did) return null;
  const handle = author.handle && author.handle !== "handle.invalid" ? author.handle : author.did;
  if (author.avatar) rememberAvatar(author.did, author.avatar);
  return {
    did: author.did,
    handle,
    displayName: author.displayName?.trim() || undefined,
    avatar: author.avatar ? `${settings.base}/media?avatar=${encodeURIComponent(author.did)}` : undefined,
    url: `https://bsky.app/profile/${encodeURIComponent(handle)}`,
  };
}

function isHidden(post: ThreadPost, author: Person, url: string): boolean {
  const labels = [...(post.labels ?? []), ...(post.author?.labels ?? [])];
  if (labels.some((label) => label.val && HIDING_LABELS.has(label.val))) return true;
  return [url, post.uri ?? "", author.url, author.handle, author.did].some((value) => value && hidden.has(normalise(value)));
}

function collect(nodes: ThreadNode[] = [], depth: number, hiddenByAuthor: Set<string>, out: Reply[]) {
  const ordered = nodes
    .filter((node) => node.$type === "app.bsky.feed.defs#threadViewPost" && node.post)
    .sort((a, b) => (a.post?.record?.createdAt ?? "").localeCompare(b.post?.record?.createdAt ?? ""));
  for (const node of ordered) {
    const post = node.post!;
    const author = post.author && person(post.author);
    const key = post.uri?.split("/").pop();
    if (!author || !post.uri || !key || hiddenByAuthor.has(post.uri)) continue;
    const url = `${author.url}/post/${key}`;
    if (isHidden(post, author, url)) continue;
    out.push({
      uri: post.uri,
      url,
      author,
      byAuthor: settings.allowedAuthors.includes(author.did),
      createdAt: post.record?.createdAt ?? "",
      text: segments(post.record?.text ?? "", post.record?.facets),
      depth,
      likeCount: post.likeCount ?? 0,
      repostCount: post.repostCount ?? 0,
    });
    if (depth + 1 < MAX_DEPTH) collect(node.replies, depth + 1, hiddenByAuthor, out);
  }
}

async function fetchThread(uri: string): Promise<Thread> {
  const [{ thread, threadgate }, { likes = [] }, { repostedBy = [] }] = await Promise.all([
    call<{ thread: ThreadNode; threadgate?: { record?: { hiddenReplies?: string[] } } }>("app.bsky.feed.getPostThread", {
      uri,
      depth: String(MAX_DEPTH),
      parentHeight: "0",
    }),
    call<{ likes?: { actor?: Author }[] }>("app.bsky.feed.getLikes", { uri, limit: String(MAX_FACES) }),
    call<{ repostedBy?: Author[] }>("app.bsky.feed.getRepostedBy", { uri, limit: String(MAX_FACES) }),
  ]);
  const root = thread.post ?? {};
  const rootAuthor = root.author && person(root.author);
  const replies: Reply[] = [];
  collect(thread.replies, 0, new Set(threadgate?.record?.hiddenReplies ?? []), replies);
  return {
    uri,
    url: rootAuthor ? `${rootAuthor.url}/post/${uri.split("/").pop()}` : "",
    likeCount: root.likeCount ?? likes.length,
    repostCount: root.repostCount ?? repostedBy.length,
    likes: likes.flatMap(({ actor }) => (actor ? [person(actor)].filter((p): p is Person => !!p) : [])),
    reposts: repostedBy.map(person).filter((p): p is Person => !!p),
    replies,
  };
}

const cache = new Map<string, { thread: Thread | null; at: number; failedAt: number }>();
const pending = new Map<string, Promise<Thread>>();

export async function getThread(uri: string): Promise<Thread | null> {
  const cached = cache.get(uri);
  const now = Date.now();
  if (cached && (now - cached.at < CACHE_MS || now - cached.failedAt < FAILURE_BACKOFF_MS)) return cached.thread;
  let request = pending.get(uri);
  if (!request) {
    request = fetchThread(uri).finally(() => pending.delete(uri));
    pending.set(uri, request);
  }
  try {
    const thread = await request;
    if (!cached && cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
    cache.set(uri, { thread, at: Date.now(), failedAt: 0 });
    return thread;
  } catch (error) {
    console.warn("[atmosphere] could not read the thread:", error instanceof Error ? error.message : error);
    if (cached) {
      cached.failedAt = Date.now();
      return cached.thread;
    }
    cache.set(uri, { thread: null, at: 0, failedAt: Date.now() });
    return null;
  }
}

/** After the reader posts or reacts, the next load reads the thread afresh. */
export function forgetThread(uri: string) {
  cache.delete(uri);
}
