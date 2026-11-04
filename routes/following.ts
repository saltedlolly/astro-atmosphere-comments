// Whether an account follows one of the site's own accounts, for the Follow
// button: ?actor=<reader's DID>&subject=<DID in allowedAuthors> gives
// { following } (the follow record's AT URI, or ""). From Bluesky's public
// AppView: who follows whom is public.
import type { APIRoute } from "astro";
import { addressOf, json, rateLimit } from "../lib/http";
import settings from "../lib/settings";

const DID = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/;
const perAddress = rateLimit(30, 300);

export const GET: APIRoute = async (context) => {
  const actor = context.url.searchParams.get("actor") ?? "";
  const subject = context.url.searchParams.get("subject") ?? "";
  if (!DID.test(actor) || !settings.allowedAuthors.includes(subject)) return json({ error: "not-allowed" }, 400);
  if (perAddress(addressOf(context))) return json({ error: "too-many" }, 429);
  try {
    const query = new URLSearchParams({ actor, others: subject });
    const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getRelationships?${query}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`getRelationships ${response.status}`);
    const data = (await response.json()) as { relationships?: Array<{ did?: string; following?: string }> };
    return json({ following: data.relationships?.find((relationship) => relationship.did === subject)?.following ?? "" });
  } catch {
    return json({ error: "unavailable" }, 502);
  }
};
