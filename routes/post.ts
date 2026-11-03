// The announcement being quoted, for the Quote preview: wording, author (with
// avatar) and link card (with its picture). Images come through this site
// (routes/media.ts), so readers' browsers don't contact Bluesky.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { publicProfile } from "../lib/profile";
import { quotedPost } from "../lib/quoted";
import { isSitePost } from "../lib/reader";
import settings from "../lib/settings";

export const GET: APIRoute = async ({ url }) => {
  const uri = url.searchParams.get("uri");
  if (!isSitePost(uri)) return json({ error: "not-allowed" }, 400);
  try {
    const quoted = await quotedPost(uri);
    if (!quoted) return json({ error: "not-found" }, 404);
    const { external } = quoted;
    return json({
      author: publicProfile(quoted.author),
      text: quoted.text,
      ...(external && {
        external: {
          uri: external.uri,
          title: external.title,
          description: external.description,
          thumb: external.thumbSource ? `${settings.base}/media?thumb=${encodeURIComponent(uri)}` : undefined,
        },
      }),
    });
  } catch {
    return json({ error: "unavailable" }, 502);
  }
};
