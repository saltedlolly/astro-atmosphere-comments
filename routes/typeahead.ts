// Account suggestions as the reader types (?q=start of a handle or name), from
// Bluesky's public typeahead search: for @mentions in the comment box, and for
// the handle box when signing in, so readers can see they've found the right
// account. Avatars come through this site. Signed-in readers are limited per
// account; everyone else per address, with an overall cap as well (behind a
// proxy every visitor may share one address), so the site can't be used to
// flood Bluesky's search. Answers are remembered for a minute.
import type { APIRoute } from "astro";
import { addressOf, json, rateLimit } from "../lib/http";
import settings from "../lib/settings";
import { rememberAvatar } from "../lib/avatars";

const perAddress = rateLimit(60, 600);
const overall = rateLimit(600, 12000);

type Actor = { did: string; handle: string; displayName?: string; avatar?: string };
const recent = new Map<string, { actors: Actor[]; at: number }>();
const REMEMBER_MS = 60 * 1000;
const MAX_REMEMBERED = 500;

async function search(q: string): Promise<Actor[]> {
  const key = q.toLowerCase();
  const known = recent.get(key);
  if (known && Date.now() - known.at < REMEMBER_MS) return known.actors;
  const response = await fetch(
    `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(q)}&limit=6`,
    { signal: AbortSignal.timeout(4000) },
  );
  if (!response.ok) return [];
  const actors = ((await response.json()) as { actors?: Actor[] }).actors ?? [];
  if (recent.size >= MAX_REMEMBERED) recent.delete(recent.keys().next().value!);
  recent.set(key, { actors, at: Date.now() });
  return actors;
}

export const GET: APIRoute = async (context) => {
  const q = (context.url.searchParams.get("q") ?? "").trim().replace(/^@/, "");
  if (!q || q.length > 64 || /[\s<>"]/.test(q)) return json({ actors: [] });
  if (perAddress(addressOf(context)) || overall("all")) return json({ error: "too-many" }, 429);

  try {
    const actors = (await search(q)).map((actor) => {
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
