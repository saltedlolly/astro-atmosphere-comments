// Avatars this site has recently shown (people in a comment thread, and
// accounts suggested for an @mention), so routes/media.ts may pass them on for
// a while. Kept in memory only; anything else is refused.
const LIFETIME_MS = 30 * 60 * 1000;
const MAX = 5000;
const known = new Map<string, { source: string; until: number }>();

export function rememberAvatar(did: string, source: string) {
  if (known.size >= MAX) known.delete(known.keys().next().value!);
  known.set(did, { source, until: Date.now() + LIFETIME_MS });
}

export function knownAvatar(did: string): string | undefined {
  const entry = known.get(did);
  if (!entry) return undefined;
  if (entry.until < Date.now()) {
    known.delete(did);
    return undefined;
  }
  return entry.source;
}
