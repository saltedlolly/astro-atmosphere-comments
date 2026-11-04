// Starts signing in: the reader typed their handle (or DID) into the comment
// box. Their own account host is found from it, and they are sent there to
// approve this site's request to post comments for them.
import type { APIRoute } from "astro";
import { safeReturnPath, withStatus } from "../lib/http";
import { DELETE_SCOPE, oauthClient, SCOPE } from "../lib/oauth";

export const POST: APIRoute = async ({ request, url, redirect }) => {
  const form = await request.formData();
  const returnTo = safeReturnPath(form.get("returnTo"));
  const handle = String(form.get("handle") ?? "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
  if (!handle || handle.length > 253 || !/^(did:[a-z0-9:._%-]+|[a-z0-9.-]+\.[a-z0-9-]+)$/.test(handle)) {
    return redirect(withStatus(returnTo, "invalid-handle"), 303);
  }

  try {
    const client = await oauthClient(url.origin);
    const authorizeUrl = await client.authorize(handle, {
      // The delete route sends readers back here (with permission=delete) when
      // they first delete a comment and haven't allowed that yet.
      scope: form.get("permission") === "delete" ? `${SCOPE} ${DELETE_SCOPE}` : SCOPE,
      state: JSON.stringify({ returnTo }),
    });
    return redirect(authorizeUrl.href, 303);
  } catch (error) {
    console.warn("[atmosphere] sign-in could not start:", error instanceof Error ? error.message : error);
    return redirect(withStatus(returnTo, "account-not-found"), 303);
  }
};
