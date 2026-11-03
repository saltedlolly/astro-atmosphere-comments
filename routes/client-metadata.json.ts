// The site's OAuth client metadata. Account hosts fetch this address (it is
// the site's client ID) to learn its name, logo, callback address and scope.
import type { APIRoute } from "astro";
import { clientMetadata } from "../lib/oauth";

export const GET: APIRoute = () =>
  Response.json(clientMetadata(), { headers: { "Cache-Control": "public, max-age=600" } });
