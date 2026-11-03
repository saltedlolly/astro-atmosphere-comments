// Public profile details (handle, display name, avatar) from Bluesky's public
// API, for signed-in readers and the site's own accounts. Cached for 10
// minutes; nothing is stored.
import settings from "./settings";

const APPVIEW = "https://public.api.bsky.app";
const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHED = 500;

export type Profile = {
  did: string;
  handle: string;
  displayName?: string;
  /** The avatar's address on Bluesky's image server (never sent to browsers). */
  avatarSource?: string;
};

const cache = new Map<string, { profile: Profile; at: number }>();

export async function profileFor(did: string): Promise<Profile> {
  const cached = cache.get(did);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.profile;
  let profile: Profile = { did, handle: did };
  try {
    const response = await fetch(`${APPVIEW}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = (await response.json()) as { handle?: string; displayName?: string; avatar?: string };
      profile = {
        did,
        handle: data.handle || did,
        displayName: data.displayName || undefined,
        avatarSource: data.avatar || undefined,
      };
    }
  } catch {
    // Fall back to the DID; the comment box still works.
  }
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(did, { profile, at: Date.now() });
  return profile;
}

/** A profile as browsers get it: the avatar comes through this site (routes/media.ts). */
export function publicProfile(profile: Profile) {
  return {
    did: profile.did,
    handle: profile.handle,
    displayName: profile.displayName,
    avatar: profile.avatarSource ? `${settings.base}/media?avatar=${encodeURIComponent(profile.did)}` : undefined,
  };
}
