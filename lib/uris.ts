// Telling the site's own posts and threads apart from everything else, for
// the routes and the browser alike. Nothing outside these can be replied to,
// liked, reposted or quoted through the site.
import settings from "./public-settings";

const POST_URI = /^at:\/\/(did:[a-z0-9]+:[a-zA-Z0-9._:%-]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9._~-]+)$/;

export const isPostUri = (uri: unknown): uri is string => typeof uri === "string" && POST_URI.test(uri);

/** The DID that wrote a post, from its AT URI. */
export const authorOf = (uri: string) => POST_URI.exec(uri)?.[1] ?? "";

/** The post's record key, the last part of its AT URI. */
export const rkeyOf = (uri: string) => POST_URI.exec(uri)?.[2] ?? "";

/** True for a post by one of the site's own accounts (an announcement). */
export function isSitePost(uri: unknown): uri is string {
  return isPostUri(uri) && settings.allowedAuthors.includes(authorOf(uri));
}

export type PostView = {
  uri: string;
  cid: string;
  author?: { did: string };
  record?: { reply?: { root?: { uri?: string } } };
  viewer?: { like?: string; repost?: string };
};

/** True for one of the site's announcements, or a comment somewhere under one. */
export const inSiteThread = (view: PostView): boolean =>
  isSitePost(view.uri) || isSitePost(view.record?.reply?.root?.uri);
