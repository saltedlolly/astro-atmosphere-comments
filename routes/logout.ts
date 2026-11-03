// Signs the reader out on this site and asks their host to cancel this
// site's permission to post for them.
import type { APIRoute } from "astro";
import { fromThisSite, json } from "../lib/http";
import { oauthClient } from "../lib/oauth";
import { signedInDid, signOut } from "../lib/visitor";

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!fromThisSite(request, url)) return json({ error: "forbidden" }, 403);
  const did = await signedInDid(cookies);
  await signOut(cookies);
  if (did) {
    try {
      await (await oauthClient(url.origin)).revoke(did);
    } catch (error) {
      console.warn("[atmosphere] revoke failed:", error instanceof Error ? error.message : error);
    }
  }
  return json({ signedIn: false });
};
