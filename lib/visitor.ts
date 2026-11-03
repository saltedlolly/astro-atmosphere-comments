// Who is signed in on this browser.
//
// The cookie holds only a random value. The server keeps which account that
// value belongs to, so signing out really ends it, and the cookie is useless
// to anyone who copies it after that. HttpOnly keeps it away from page
// scripts; SameSite=Lax lets it come back with the reader from their account
// host (a top-level navigation) but not with other sites' form posts.
import { randomBytes } from "node:crypto";
import type { AstroCookies } from "astro";
import { fileStore } from "./store";

const COOKIE = "atmosphere_session";
const LIFETIME_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

type Visitor = { did: string; signedInAt: string };

const visitors = fileStore<Visitor>("visitors", LIFETIME_MS);

export async function signIn(cookies: AstroCookies, url: URL, did: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await visitors.set(token, { did, signedInAt: new Date().toISOString() });
  cookies.set(COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    maxAge: LIFETIME_MS / 1000,
  });
}

/** The signed-in account's DID, if any. */
export async function signedInDid(cookies: AstroCookies): Promise<string | undefined> {
  const token = cookies.get(COOKIE)?.value;
  if (!token || token.length > 100) return undefined;
  return (await visitors.get(token))?.did;
}

export async function signOut(cookies: AstroCookies): Promise<void> {
  const token = cookies.get(COOKIE)?.value;
  if (token && token.length <= 100) await visitors.del(token);
  cookies.delete(COOKIE, { path: "/" });
}
