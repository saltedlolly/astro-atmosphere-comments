// Who is signed in on this browser, for the comment box.
import type { APIRoute } from "astro";
import { json } from "../lib/http";
import { profileFor, publicProfile } from "../lib/profile";
import { signedInDid } from "../lib/visitor";

export const GET: APIRoute = async ({ cookies }) => {
  const did = await signedInDid(cookies);
  if (!did) return json({ signedIn: false });
  const profile = await profileFor(did);
  return json({ signedIn: true, ...publicProfile(profile) });
};
