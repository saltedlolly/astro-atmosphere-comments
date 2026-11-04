// Looks up an account for signing in: ?id=<handle or DID> gives its DID, its
// DID document (which names the reader's account host) and its handle, as
// the browser's OAuth library needs (lib/client/account.ts). Done here, so a
// reader's browser contacts only their own account host while signing in,
// not Bluesky's servers or the PLC directory. Nothing is stored; answers are
// remembered for ten minutes, and requests are limited per address.
import type { APIRoute } from "astro";
import { addressOf, json, rateLimit } from "../lib/http";

const APPVIEW = "https://public.api.bsky.app/xrpc/";
const HANDLE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const DID_PLC = /^did:plc:[a-z2-7]{24}$/;
const DID_WEB = /^did:web:([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const REMEMBER_MS = 10 * 60 * 1000;

const perAddress = rateLimit(20, 200);
const overall = rateLimit(300, 6000);
const recent = new Map<string, { answer: Identity; at: number }>();

type DidDocument = { id: string; alsoKnownAs?: string[]; service?: { id: string; type: string; serviceEndpoint: unknown }[] };
type Identity = { did: string; didDoc: DidDocument; handle: string };

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${response.status}`);
  if (Number(response.headers.get("content-length") || 0) > 100_000) throw new Error("too big");
  return (await response.json()) as T;
}

async function didForHandle(handle: string): Promise<string> {
  const { did } = await getJson<{ did?: string }>(`${APPVIEW}com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!did || !(DID_PLC.test(did) || DID_WEB.test(did))) throw new Error("no DID");
  return did;
}

async function documentFor(did: string): Promise<DidDocument> {
  const document = await getJson<DidDocument>(
    did.startsWith("did:web:") ? `https://${did.slice("did:web:".length)}/.well-known/did.json` : `https://plc.directory/${did}`,
  );
  if (document.id !== did) throw new Error("wrong document");
  return document;
}

async function lookUp(id: string): Promise<Identity> {
  const did = id.startsWith("did:") ? id : await didForHandle(id);
  const didDoc = await documentFor(did);
  // The handle counts only if the document claims it and it points back here.
  const claimed = didDoc.alsoKnownAs?.find((alias) => alias.startsWith("at://"))?.slice("at://".length).toLowerCase();
  let handle = "handle.invalid";
  if (claimed && claimed === id) handle = claimed;
  else if (claimed && HANDLE.test(claimed)) handle = (await didForHandle(claimed).catch(() => "")) === did ? claimed : handle;
  return { did, didDoc, handle };
}

export const GET: APIRoute = async (context) => {
  const id = (context.url.searchParams.get("id") ?? "").trim().toLowerCase();
  if (!(HANDLE.test(id) || DID_PLC.test(id) || DID_WEB.test(id)) || id.length > 253) return json({ error: "bad-request" }, 400);
  const known = recent.get(id);
  if (known && Date.now() - known.at < REMEMBER_MS) return json(known.answer);
  if (perAddress(addressOf(context)) || overall("all")) return json({ error: "too-many" }, 429);
  try {
    const answer = await lookUp(id);
    if (recent.size >= 500) recent.delete(recent.keys().next().value!);
    recent.set(id, { answer, at: Date.now() });
    return json(answer);
  } catch {
    return json({ error: "not-found" }, 404);
  }
};
