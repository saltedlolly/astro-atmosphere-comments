// Turning what a page gives us into the announcement's AT URI: an AT URI
// as it is, a bsky.app post address, or a Standard.site document record whose
// `bskyPostRef` points at its announcement.
const APPVIEW = "https://public.api.bsky.app/xrpc/";

const cache = new Map<string, { uri: string | null; at: number }>();
const CACHE_MS = 10 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${new URL(url).pathname} returned ${response.status}`);
  return (await response.json()) as T;
}

/** A handle → its DID, through Bluesky's public service. */
export async function resolveHandle(handle: string): Promise<string> {
  const { did } = await getJson<{ did: string }>(
    `${APPVIEW}com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
  );
  return did;
}

/** https://bsky.app/profile/<handle or DID>/post/<key> → at:// URI. */
export async function postUriFromUrl(url: string): Promise<string | null> {
  const match = url.match(/^https:\/\/bsky\.app\/profile\/([^/?#]+)\/post\/([A-Za-z0-9._~:-]+)/);
  if (!match) return null;
  const actor = decodeURIComponent(match[1]);
  const did = actor.startsWith("did:") ? actor : await resolveHandle(actor);
  return `at://${did}/app.bsky.feed.post/${match[2]}`;
}

/** Where an account's data lives (its PDS), from its DID document. */
async function pdsFor(did: string): Promise<string> {
  const document = await getJson<{ service?: { id?: string; serviceEndpoint?: string }[] }>(
    did.startsWith("did:web:")
      ? `https://${did.slice("did:web:".length)}/.well-known/did.json`
      : `https://plc.directory/${encodeURIComponent(did)}`,
  );
  const endpoint = document.service?.find((service) => service.id === "#atproto_pds")?.serviceEndpoint;
  if (!endpoint) throw new Error("no PDS in DID document");
  return endpoint;
}

/** A Standard.site document record (at://did/site.standard.document/key) → its announcement. */
export async function announcementFromDocument(documentUri: string): Promise<string | null> {
  const match = documentUri.match(/^at:\/\/(did:[a-z0-9]+:[a-zA-Z0-9._:%-]+)\/site\.standard\.document\/([A-Za-z0-9._~:-]+)$/);
  if (!match) return null;
  const cached = cache.get(documentUri);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.uri;
  const [, did, rkey] = match;
  const pds = await pdsFor(did);
  const record = await getJson<{ value?: { bskyPostRef?: { uri?: string } } }>(
    `${pds.replace(/\/+$/, "")}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=site.standard.document&rkey=${encodeURIComponent(rkey)}`,
  );
  const uri = record.value?.bskyPostRef?.uri ?? null;
  if (cache.size > 500) cache.clear();
  cache.set(documentUri, { uri, at: Date.now() });
  return uri;
}
