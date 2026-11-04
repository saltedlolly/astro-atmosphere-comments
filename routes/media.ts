// Passes on a few images from Bluesky's image server, so readers' browsers
// never load anything from Bluesky directly:
//   ?avatar=<did>  a site account's avatar, or one shown recently (in a
//                  thread, suggested for an @mention, or a signed-in reader's
//                  own, looked up by routes/profile.ts);
//   ?thumb=<uri>   the link-card picture of one of the site's announcements.
// Nothing else can be fetched through it.
import type { APIRoute } from "astro";
import { profileFor } from "../lib/profile";
import { quotedPost } from "../lib/quoted";
import { isSitePost } from "../lib/uris";
import settings from "../lib/settings";
import { knownAvatar } from "../lib/avatars";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 3 * 1024 * 1024;

const notFound = () => new Response("Not found", { status: 404 });

export const GET: APIRoute = async ({ url }) => {
  const avatar = url.searchParams.get("avatar");
  const thumb = url.searchParams.get("thumb");
  let source: string | undefined;

  if (avatar) {
    const isSiteAccount = settings.allowedAuthors.includes(avatar);
    const recentlyShown = knownAvatar(avatar);
    if (recentlyShown) {
      source = recentlyShown;
    } else {
      if (!isSiteAccount) return notFound();
      source = (await profileFor(avatar)).avatarSource;
    }
  } else if (thumb && isSitePost(thumb)) {
    source = (await quotedPost(thumb).catch(() => null))?.external?.thumbSource;
  }
  if (!source || new URL(source).hostname !== "cdn.bsky.app") return notFound();

  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(8000) });
    const type = response.headers.get("content-type")?.split(";")[0] ?? "";
    if (!response.ok || !IMAGE_TYPES.has(type)) return notFound();
    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return notFound();
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
};
