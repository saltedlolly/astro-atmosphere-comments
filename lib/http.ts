// Small helpers shared by the routes.

/** A same-site path to send the reader back to, or "/" if the value isn't one. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value.slice(0, 500);
}

/** `path` with `?atmosphere=<status>` added (kept before any #fragment). */
export function withStatus(path: string, status: string): string {
  const [beforeHash, hash] = path.split("#", 2);
  const separator = beforeHash.includes("?") ? "&" : "?";
  return `${beforeHash}${separator}atmosphere=${encodeURIComponent(status)}${hash ? `#${hash}` : ""}`;
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Requests that change something must come from a page on this site. Browsers
 * always send Origin with a cross-site POST, so a missing or different one is
 * refused. (Astro checks this for form posts; this covers JSON requests too.)
 */
export function fromThisSite(request: Request, url: URL): boolean {
  return request.headers.get("origin") === url.origin;
}
