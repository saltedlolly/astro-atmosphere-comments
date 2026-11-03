// The public half of the site's signing key, so account hosts can check that
// requests claiming to come from this site really do.
import type { APIRoute } from "astro";
import { privateKey } from "../lib/oauth";

export const GET: APIRoute = async () => {
  try {
    const key = await privateKey();
    return Response.json({ keys: [key.publicJwk] }, { headers: { "Cache-Control": "public, max-age=600" } });
  } catch {
    return new Response("Not configured", { status: 404 });
  }
};
