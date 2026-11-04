// The site's OAuth client metadata. Account hosts fetch this address (it is
// the site's client ID) to learn its name, logo, callback address and scope.
import type { APIRoute } from "astro";
import { clientMetadata } from "../lib/permissions";
import settings from "../lib/settings";

export const GET: APIRoute = () =>
  Response.json(clientMetadata(settings), { headers: { "Cache-Control": "public, max-age=600" } });
