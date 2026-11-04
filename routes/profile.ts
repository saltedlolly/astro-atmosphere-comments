// A signed-in reader's public profile, for the comment box and the account
// menu: ?did=<DID> gives their handle, display name and avatar (through this
// site, routes/media.ts). The page asks for it after the reader signs in in
// their own browser; it's public, so no sign-in is needed to ask.
import type { APIRoute } from "astro";
import { rememberAvatar } from "../lib/avatars";
import { addressOf, json, rateLimit } from "../lib/http";
import { profileFor, publicProfile } from "../lib/profile";

const DID = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/;
const perAddress = rateLimit(30, 300);

export const GET: APIRoute = async (context) => {
  const did = context.url.searchParams.get("did") ?? "";
  if (!DID.test(did) || did.length > 200) return json({ error: "bad-request" }, 400);
  if (perAddress(addressOf(context))) return json({ error: "too-many" }, 429);
  const profile = await profileFor(did);
  if (profile.avatarSource) rememberAvatar(did, profile.avatarSource);
  return json(publicProfile(profile));
};
