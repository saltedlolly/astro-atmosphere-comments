// Finds the links, @mentions and #hashtags in a comment before the reader's
// browser posts it, as the Bluesky app does: POST { text } gives { text,
// facets }. Mentions are looked up here (Bluesky's public API), so the
// reader's browser doesn't contact Bluesky. Nothing is posted or kept.
import { AtpAgent, RichText } from "@atproto/api";
import type { APIRoute } from "astro";
import { addressOf, fromThisSite, json, rateLimit } from "../lib/http";

const publicAgent = new AtpAgent({ service: "https://public.api.bsky.app" });
const perAddress = rateLimit(20, 200);

export const POST: APIRoute = async (context) => {
  const { request, url } = context;
  if (!fromThisSite(request, url)) return json({ error: "forbidden" }, 403);
  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  if (typeof text !== "string" || !text.trim() || text.length > 3000) return json({ error: "bad-request" }, 400);
  if (perAddress(addressOf(context))) return json({ error: "too-many" }, 429);
  const richText = new RichText({ text: text.trim() });
  try {
    await richText.detectFacets(publicAgent);
  } catch {
    richText.detectFacetsWithoutResolution();
  }
  return json({ text: richText.text, facets: richText.facets ?? [] });
};
