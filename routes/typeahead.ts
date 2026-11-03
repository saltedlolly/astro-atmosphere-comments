// Suggestions for an @mention as the reader types (?q=start of a handle or
// name), from Bluesky's public typeahead search. Only for signed-in readers,
// so it can't be used as a free search proxy; avatars come through this site.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { rateLimit } from "../lib/reader";
import settings from "../lib/settings";
import { rememberAvatar } from "../lib/avatars";
import { signedInDid } from "../lib/visitor";

const tooMany = rateLimit(60, 1200);

export const GET: APIRoute = async ({ url, cookies }) => {
  const did = await signedInDid(cookies);
  if (!did) return json({ error: "signed-out" }, 401);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q || q.length > 64 || /[\s<>"]/.test(q)) return json({ actors: [] });
  if (tooMany(did)) return json({ error: "too-many" }, 429);
  try {
    const response = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=6`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!response.ok) return json({ actors: [] });
    const data = (await response.json()) as {
      actors?: { did: string; handle: string; displayName?: string; avatar?: string }[];
    };
    const actors = (data.actors ?? []).map((actor) => {
      if (actor.avatar) rememberAvatar(actor.did, actor.avatar);
      return {
        handle: actor.handle,
        displayName: actor.displayName || undefined,
        avatar: actor.avatar ? `${settings.base}/media?avatar=${encodeURIComponent(actor.did)}` : undefined,
      };
    });
    return json({ actors });
  } catch {
    return json({ actors: [] });
  }
};
