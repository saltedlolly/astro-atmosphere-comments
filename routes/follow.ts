// Following one of the site's own accounts (allowedAuthors) as the signed-in
// reader, or unfollowing it. Nothing else can be followed through the site.
// GET ?subject=<did>: { following }. POST { subject, on }: follows or
// unfollows. Readers who haven't allowed following yet get "needs-permission",
// and the page sends them to approve it.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { allows, createRecord, deleteRecord, rateLimit, reader } from "../lib/reader";
import settings from "../lib/settings";

const tooMany = rateLimit(10, 60);

// Whether the reader follows `subject`: the follow record's address, or "".
// From Bluesky's public AppView, so no extra permission is needed to know.
async function followRecord(readerDid: string, subject: string): Promise<string> {
  const query = new URLSearchParams({ actor: readerDid, others: subject });
  const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.graph.getRelationships?${query}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`getRelationships ${response.status}`);
  const data = (await response.json()) as { relationships?: Array<{ did?: string; following?: string }> };
  return data.relationships?.find((relationship) => relationship.did === subject)?.following ?? "";
}

export const GET: APIRoute = async ({ request, url, cookies }) => {
  const subject = url.searchParams.get("subject") ?? "";
  if (!settings.allowedAuthors.includes(subject)) return json({ error: "not-allowed" }, 400);
  const signedIn = await reader(request, url, cookies);
  if (signedIn instanceof Response) return signedIn;
  try {
    return json({ following: !!(await followRecord(signedIn.did, subject)) });
  } catch {
    return json({ error: "unavailable" }, 502);
  }
};

export const POST: APIRoute = async ({ request, url, cookies }) => {
  const signedIn = await reader(request, url, cookies);
  if (signedIn instanceof Response) return signedIn;

  let body: { subject?: unknown; on?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad-request" }, 400);
  }
  const { subject, on } = body;
  // Only the site's own accounts, and never yourself.
  if (typeof subject !== "string" || !settings.allowedAuthors.includes(subject) || subject === signedIn.did || typeof on !== "boolean") {
    return json({ error: "not-allowed" }, 400);
  }
  if (!allows(signedIn, "app.bsky.graph.follow", on ? "create" : "delete")) return json({ error: "needs-permission" }, 403);
  if (tooMany(signedIn.did)) return json({ error: "too-many" }, 429);

  try {
    const existing = await followRecord(signedIn.did, subject);
    if (on && !existing) {
      await createRecord(signedIn, "app.bsky.graph.follow", {
        $type: "app.bsky.graph.follow",
        subject,
        createdAt: new Date().toISOString(),
      });
    } else if (!on && existing) {
      await deleteRecord(signedIn, existing);
    }
    return json({ following: on });
  } catch (error) {
    console.warn("[atmosphere] follow failed:", error instanceof Error ? error.message : error);
    return json({ error: "post-failed" }, 502);
  }
};
