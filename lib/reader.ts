// What every action needs: a request from this site, a signed-in reader, and
// an OAuth session with all the permissions in SCOPE. Readers who signed in
// before the site asked for more (likes and reposts were added later) are
// asked to sign in again rather than meeting a confusing failure.
import type { OAuthSession } from "@atproto/oauth-client-node";
import type { AstroCookies } from "astro";
import { fromThisSite, json } from "./http";
import { oauthClient, SCOPE } from "./oauth";
import settings from "./settings";
import { signedInDid, signOut } from "./visitor";

export type Reader = { did: string; session: OAuthSession };

const APPVIEW_PROXY = "did:web:api.bsky.app#bsky_appview";
const POST_URI = /^at:\/\/(did:[a-z0-9]+:[a-zA-Z0-9._:%-]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9._~-]+)$/;

/** The reader, or the Response to send instead. */
export async function reader(request: Request, url: URL, cookies: AstroCookies): Promise<Reader | Response> {
  // Requests that change something must come from a page on this site.
  // Browsers leave Origin off same-site GETs, and a GET only reads (other
  // sites' scripts can't send the SameSite cookie or read the answer).
  if (request.method !== "GET") {
    if (!fromThisSite(request, url)) return json({ error: "forbidden" }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "bad-request" }, 415);
  }
  const did = await signedInDid(cookies);
  if (!did) return json({ error: "signed-out" }, 401);
  try {
    const session = await (await oauthClient(url.origin)).restore(did);
    // Compared by permission name ("repo:app.bsky.feed.like"), since a host
    // may write the parameters after it differently.
    const granted = (await session.getTokenInfo(false)).scope.split(" ").map((part) => part.split("?")[0]);
    if (!SCOPE.split(" ").every((part) => granted.includes(part.split("?")[0]))) {
      await signOut(cookies);
      return json({ error: "new-permissions" }, 401);
    }
    return { did, session };
  } catch {
    // The grant has expired or been revoked: the reader needs to sign in again.
    await signOut(cookies);
    return json({ error: "signed-out" }, 401);
  }
}

/** True for a post by one of the site's own accounts (an announcement). */
export function isSitePost(uri: unknown): uri is string {
  const match = typeof uri === "string" ? POST_URI.exec(uri) : null;
  return !!match && settings.allowedAuthors.includes(match[1]);
}

export const isPostUri = (uri: unknown): uri is string => typeof uri === "string" && POST_URI.test(uri);

/** True for one of the site's announcements, or a comment somewhere under one. */
export const inSiteThread = (view: PostView): boolean =>
  isSitePost(view.uri) || isSitePost(view.record?.reply?.root?.uri);

export type PostView = {
  uri: string;
  cid: string;
  record?: { reply?: { root?: { uri?: string } } };
  viewer?: { like?: string; repost?: string };
};

/** Posts as the reader sees them (including whether they've liked or reposted them). */
export async function postsAsReader(session: OAuthSession, uris: string[]): Promise<PostView[]> {
  const views: PostView[] = [];
  // Bluesky answers for at most 25 posts at a time.
  for (let start = 0; start < uris.length; start += 25) {
    const query = uris
      .slice(start, start + 25)
      .map((uri) => `uris=${encodeURIComponent(uri)}`)
      .join("&");
    const response = await session.fetchHandler(`/xrpc/app.bsky.feed.getPosts?${query}`, {
      headers: { "atproto-proxy": APPVIEW_PROXY },
    });
    if (!response.ok) throw new Error(`getPosts ${response.status}`);
    views.push(...(((await response.json()) as { posts?: PostView[] }).posts ?? []));
  }
  return views;
}

export async function createRecord(reader: Reader, collection: string, record: Record<string, unknown>) {
  const response = await reader.session.fetchHandler("/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo: reader.did, collection, record }),
  });
  if (!response.ok) throw new Error(`createRecord ${response.status} ${await response.text().catch(() => "")}`);
  return (await response.json()) as { uri: string; cid: string };
}

/** Deletes one of the reader's own records, given its AT URI. */
export async function deleteRecord(reader: Reader, uri: string) {
  const [, repo, collection, rkey] = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/) ?? [];
  if (repo !== reader.did || !collection || !rkey) throw new Error("not the reader's record");
  const response = await reader.session.fetchHandler("/xrpc/com.atproto.repo.deleteRecord", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ repo: reader.did, collection, rkey }),
  });
  if (!response.ok) throw new Error(`deleteRecord ${response.status}`);
}

/** A simple per-account limit: at most `perMinute` a minute and `perHour` an hour. */
export function rateLimit(perMinute: number, perHour: number) {
  const recent = new Map<string, number[]>();
  return (did: string): boolean => {
    const now = Date.now();
    const times = (recent.get(did) ?? []).filter((time) => now - time < 60 * 60 * 1000);
    recent.set(did, times);
    if (times.length >= perHour || times.filter((time) => now - time < 60 * 1000).length >= perMinute) return true;
    times.push(now);
    return false;
  };
}
