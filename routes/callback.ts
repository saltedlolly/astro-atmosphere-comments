// The reader's account host sends them back here after they approve (or
// decline) this site's request. On success they are signed in on this site
// and returned to the post they were reading.
import type { APIRoute } from "astro";
import { safeReturnPath, withStatus } from "../lib/http";
import { oauthClient } from "../lib/oauth";
import { signIn } from "../lib/visitor";

function returnPathFrom(state: unknown): string {
  try {
    return safeReturnPath((JSON.parse(String(state)) as { returnTo?: unknown }).returnTo);
  } catch {
    return "/";
  }
}

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  try {
    const client = await oauthClient(url.origin);
    const { session, state } = await client.callback(url.searchParams);
    await signIn(cookies, url, session.did);
    return redirect(withStatus(returnPathFrom(state), "signed-in"), 303);
  } catch (error) {
    // The reader declined, took too long, or something went wrong. The
    // library's error still carries our state, so they can go back.
    const state = (error as { state?: unknown }).state;
    console.warn("[atmosphere] sign-in failed:", error instanceof Error ? error.message : error);
    return redirect(withStatus(returnPathFrom(state), "sign-in-failed"), 303);
  }
};
