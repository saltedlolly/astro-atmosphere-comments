// The reader's sign-in, kept only in their own browser.
//
// Readers sign in with AT Protocol OAuth as a browser ("public") client: the
// tokens, and the key they only work with (which the browser makes and won't
// let even this page's own code read out), stay in this browser's storage
// (IndexedDB). Comments, likes, reposts and follows go from the browser
// straight to the reader's own account host. The site's server never sees
// a reader's sign-in, so it has no way to act for them, and signing out
// cancels the sign-in at their host and deletes it here.
//
// What the routes used to check, this checks before anything is sent: only
// the site's announcements and the comments under them can be replied to,
// liked, reposted or quoted; only a reader's own replies under them can be
// deleted; only the site's accounts can be followed; and only the
// announcement's own author can hide comments under it.
//
// The OAuth library is loaded only when someone signs in, or comes back
// already signed in (remembered by their DID in localStorage), so other
// readers download none of it.
//
// send(path, body) answers like the old server routes did (a Response with
// JSON, the same error codes), so the components treat it the same way.
import type { BrowserOAuthClient, OAuthSession } from "@atproto/oauth-client-browser";
import { safeReturnPath, withStatus } from "../http";
import {
  ALL_SCOPES,
  callbackPath,
  clientMetadata,
  DEFAULT_PERMISSIONS,
  grantedPermissions,
  hasBase,
  type Permission,
  scopeFor,
  scopesAllow,
} from "../permissions";
import settings from "../public-settings";
import { authorOf, inSiteThread, isPostUri, isSitePost, rkeyOf, type PostView } from "../uris";

type IdentityResolver = NonNullable<ConstructorParameters<typeof BrowserOAuthClient>[0]["identityResolver"]>;

const { base } = settings;
const REMEMBERED = "atmosphere:did";
const APPVIEW_PROXY = "did:web:api.bsky.app#bsky_appview";
const MAX_GRAPHEMES = 300; // Bluesky's limit for a post
const graphemes = new Intl.Segmenter();

// localStorage can be missing or refuse (private windows, blocked storage):
// then a sign-in lasts only until the page is left.
const remembered = () => {
  try {
    return localStorage.getItem(REMEMBERED) ?? "";
  } catch {
    return "";
  }
};
const remember = (did: string) => {
  try {
    if (did) localStorage.setItem(REMEMBERED, did);
    else localStorage.removeItem(REMEMBERED);
  } catch {
    // See above.
  }
};

/** Whether this browser may have a sign-in (so the library is worth loading). */
export const maybeSignedIn = () => !!remembered();

// Locally (`astro dev`) the protocol's development client is used: no
// metadata to publish, but the site must be opened at http://127.0.0.1.
const callbackUrl = () => `${import.meta.env.DEV ? location.origin : settings.site}${callbackPath(base)}`;

let clientPromise: Promise<BrowserOAuthClient> | undefined;
function client(): Promise<BrowserOAuthClient> {
  clientPromise ??= (async () => {
    const { atprotoLoopbackClientMetadata, buildAtprotoLoopbackClientId, BrowserOAuthClient } = await import(
      "@atproto/oauth-client-browser"
    );
    const oauth = new BrowserOAuthClient({
      clientMetadata: import.meta.env.DEV
        ? atprotoLoopbackClientMetadata(buildAtprotoLoopbackClientId({ scope: ALL_SCOPES, redirect_uris: [callbackUrl()] }))
        : clientMetadata(settings),
      // Accounts are looked up through the site (routes/identity.ts), so the
      // browser contacts only the reader's own account host.
      identityResolver: {
        async resolve(id, options) {
          const response = await fetch(`${base}/identity?id=${encodeURIComponent(id)}`, { signal: options?.signal });
          if (!response.ok) throw new Error(`identity ${response.status}`);
          return (await response.json()) as Awaited<ReturnType<IdentityResolver["resolve"]>>;
        },
      },
      // Signed out elsewhere (another tab), revoked, or expired.
      onSessionDeleted: () => {
        remember("");
        sessionPromise = Promise.resolve(null);
      },
    });
    return oauth;
  })();
  return clientPromise;
}

let sessionPromise: Promise<OAuthSession | null> | undefined;
function session(): Promise<OAuthSession | null> {
  sessionPromise ??= (async () => {
    const did = remembered();
    if (!did) return null;
    try {
      return await (await client()).restore(did);
    } catch {
      remember("");
      return null;
    }
  })();
  return sessionPromise;
}

type Reader = { did: string; session: OAuthSession; scopes: string[] };

/** A JSON answer, as the routes gave. */
const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const signedOut = () => answer({ error: "signed-out" }, 401);

async function reader(): Promise<Reader | Response> {
  const current = await session();
  if (!current) return signedOut();
  try {
    const scopes = (await current.getTokenInfo(false)).scope.split(" ");
    if (!hasBase(scopes)) return signedOut();
    return { did: current.did, session: current, scopes };
  } catch {
    remember("");
    return signedOut();
  }
}

const allows = (reader: Reader, collection: string, action: string) => scopesAllow(reader.scopes, collection, action);
const needs = (permission: Permission) => answer({ error: "needs-permission", permission }, 403);

/** An XRPC call to the reader's own account host, as them. */
async function call<T>(reader: Reader, method: string, init?: { query?: string; body?: unknown; proxy?: boolean }): Promise<T> {
  const response = await reader.session.fetchHandler(`/xrpc/${method}${init?.query ? `?${init.query}` : ""}`, {
    method: init?.body === undefined ? "GET" : "POST",
    headers: {
      ...(init?.body !== undefined && { "content-type": "application/json" }),
      ...(init?.proxy && { "atproto-proxy": APPVIEW_PROXY }),
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw Object.assign(new Error(`${method} ${response.status}`), { status: response.status, code: data.error });
  return data;
}

/** Posts as the reader sees them (including whether they've liked or reposted them). */
async function postsAsReader(reader: Reader, uris: string[]): Promise<PostView[]> {
  const views: PostView[] = [];
  // Bluesky answers for at most 25 posts at a time.
  for (let start = 0; start < uris.length; start += 25) {
    const query = uris
      .slice(start, start + 25)
      .map((uri) => `uris=${encodeURIComponent(uri)}`)
      .join("&");
    views.push(...((await call<{ posts?: PostView[] }>(reader, "app.bsky.feed.getPosts", { query, proxy: true })).posts ?? []));
  }
  return views;
}

const createRecord = (reader: Reader, collection: string, record: Record<string, unknown>) =>
  call<{ uri: string; cid: string }>(reader, "com.atproto.repo.createRecord", { body: { repo: reader.did, collection, record } });

/** Deletes one of the reader's own records, given its AT URI. */
async function deleteRecord(reader: Reader, uri: string) {
  const [, repo, collection, rkey] = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/) ?? [];
  if (repo !== reader.did || !collection || !rkey) throw new Error("not the reader's record");
  await call(reader, "com.atproto.repo.deleteRecord", { body: { repo: reader.did, collection, rkey } });
}

const post = (path: string, body: unknown) =>
  fetch(`${base}/${path}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

/** So a change shows when the page is next loaded (the site keeps threads for two minutes). */
const refreshThread = (root: string | undefined) => {
  if (isSitePost(root)) void post("thread", { root }).catch(() => undefined);
};

/** Failed because the sign-in is gone (revoked, or expired): signed out. */
const failed = (error: unknown, what: string) => {
  if ((error as { status?: number }).status === 401 || /^Token/.test((error as Error).name ?? "")) {
    remember("");
    sessionPromise = Promise.resolve(null);
    return signedOut();
  }
  console.warn(`[atmosphere] ${what} failed:`, error instanceof Error ? error.message : error);
  return answer({ error: "post-failed" }, 502);
};

type Profile = { did: string; handle: string; displayName?: string; avatar?: string };
let profilePromise: Promise<Profile> | undefined;
function profile(did: string): Promise<Profile> {
  profilePromise ??= fetch(`${base}/profile?did=${encodeURIComponent(did)}`)
    .then((response) => (response.ok ? (response.json() as Promise<Profile>) : { did, handle: did }))
    .catch(() => ({ did, handle: did }));
  return profilePromise;
}

export type Me = { signedIn: boolean; did?: string; handle?: string; displayName?: string; avatar?: string; can?: Permission[] };

/** Who is signed in on this browser, and which permissions they've given (`can`). */
export async function me(): Promise<Me> {
  if (!maybeSignedIn()) return { signedIn: false };
  const signedIn = await reader();
  if (signedIn instanceof Response) return { signedIn: false };
  return { signedIn: true, ...(await profile(signedIn.did)), can: grantedPermissions(signedIn.scopes) };
}

// A comment: a reply to the announcement (`root`), or to a comment under it
// (`parent`); or a quote post of the announcement (`quote: true`).
async function comment(body: { text?: unknown; root?: unknown; parent?: unknown; quote?: unknown }) {
  const signedIn = await reader();
  if (signedIn instanceof Response) return signedIn;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const length = [...graphemes.segment(text)].length;
  if (!length) return answer({ error: "empty" }, 400);
  if (length > MAX_GRAPHEMES) return answer({ error: "too-long" }, 400);
  const root = body.root;
  if (!isSitePost(root)) return answer({ error: "not-allowed" }, 400);
  const quote = body.quote === true;
  const parent = !quote && body.parent !== undefined && body.parent !== root ? body.parent : undefined;
  if (parent !== undefined && !isPostUri(parent)) return answer({ error: "not-allowed" }, 400);
  // Readers who signed in only to like and repost haven't allowed posting yet.
  if (!allows(signedIn, "app.bsky.feed.post", "create")) return needs("post");

  try {
    const posts = await postsAsReader(signedIn, parent ? [root, parent] : [root]);
    const rootPost = posts.find((view) => view.uri === root);
    const parentPost = parent ? posts.find((view) => view.uri === parent) : rootPost;
    if (!rootPost || !parentPost) return answer({ error: "not-found" }, 404);
    // A comment being replied to must belong to this announcement's thread.
    if (parent && parentPost.record?.reply?.root?.uri !== root) return answer({ error: "not-allowed" }, 400);

    // Links, @mentions and #tags become proper links, as in the Bluesky app.
    let facets: unknown[] = [];
    try {
      const found = await post("richtext", { text });
      if (found.ok) facets = ((await found.json()) as { facets?: unknown[] }).facets ?? [];
    } catch {
      // Posted as plain text.
    }
    const record = {
      $type: "app.bsky.feed.post",
      text,
      ...(facets.length && { facets }),
      ...(quote
        ? { embed: { $type: "app.bsky.embed.record", record: { uri: rootPost.uri, cid: rootPost.cid } } }
        : {
            reply: {
              root: { uri: rootPost.uri, cid: rootPost.cid },
              parent: { uri: parentPost.uri, cid: parentPost.cid },
            },
          }),
      createdAt: new Date().toISOString(),
    };
    const created = await createRecord(signedIn, "app.bsky.feed.post", record);
    refreshThread(root);
    const author = await profile(signedIn.did);
    return answer({
      uri: created.uri,
      url: `https://bsky.app/profile/${author.handle}/post/${created.uri.split("/").pop()}`,
      text,
      author,
      createdAt: record.createdAt,
      quote,
      parent: parent ?? null,
    });
  } catch (error) {
    return failed(error, "post");
  }
}

const COLLECTIONS = { like: "app.bsky.feed.like", repost: "app.bsky.feed.repost" } as const;

// Likes or reposts a post (an announcement, or a comment under one), or takes that back.
async function react(body: { post?: unknown; kind?: unknown; on?: unknown }) {
  const signedIn = await reader();
  if (signedIn instanceof Response) return signedIn;
  const { post: uri, kind, on } = body;
  if (!isPostUri(uri) || (kind !== "like" && kind !== "repost") || typeof on !== "boolean") return answer({ error: "bad-request" }, 400);
  if (!allows(signedIn, COLLECTIONS[kind], on ? "create" : "delete")) return needs("react");
  try {
    const [view] = await postsAsReader(signedIn, [uri]);
    if (!view) return answer({ error: "not-found" }, 404);
    if (!inSiteThread(view)) return answer({ error: "not-allowed" }, 400);
    const existing = kind === "like" ? view.viewer?.like : view.viewer?.repost;
    if (on && !existing) {
      await createRecord(signedIn, COLLECTIONS[kind], {
        $type: COLLECTIONS[kind],
        subject: { uri: view.uri, cid: view.cid },
        createdAt: new Date().toISOString(),
      });
    } else if (!on && existing) {
      await deleteRecord(signedIn, existing);
    }
    refreshThread(isSitePost(view.uri) ? view.uri : view.record?.reply?.root?.uri);
    return answer({ kind, on });
  } catch (error) {
    return failed(error, kind);
  }
}

// Deletes one of the reader's own comments: a reply of theirs somewhere under
// one of the site's announcements. Nothing else, even though the permission
// covers all of their posts.
async function remove(body: { post?: unknown }) {
  const signedIn = await reader();
  if (signedIn instanceof Response) return signedIn;
  const uri = body.post;
  if (!isPostUri(uri) || !uri.startsWith(`at://${signedIn.did}/`)) return answer({ error: "not-allowed" }, 400);
  if (!allows(signedIn, "app.bsky.feed.post", "delete")) return needs("delete");
  try {
    const [view] = await postsAsReader(signedIn, [uri]);
    if (!view) return answer({ error: "not-found" }, 404);
    const root = view.record?.reply?.root?.uri;
    if (!isSitePost(root)) return answer({ error: "not-allowed" }, 400);
    await deleteRecord(signedIn, view.uri);
    refreshThread(root);
    return answer({ deleted: view.uri });
  } catch (error) {
    return failed(error, "delete");
  }
}

// Hides a comment under one of the reader's own announcements, here and on
// Bluesky (its threadgate's hiddenReplies, as the Bluesky app does). Only
// the announcement's author can; showing it again is done in the Bluesky app.
async function hide(body: { post?: unknown; root?: unknown }) {
  const signedIn = await reader();
  if (signedIn instanceof Response) return signedIn;
  const { post: uri, root } = body;
  if (!isPostUri(uri) || !isSitePost(root) || authorOf(root) !== signedIn.did || authorOf(uri) === signedIn.did) {
    return answer({ error: "not-allowed" }, 400);
  }
  if (!allows(signedIn, "app.bsky.feed.threadgate", "create") || !allows(signedIn, "app.bsky.feed.threadgate", "update")) {
    return needs("moderate");
  }
  try {
    const [view] = await postsAsReader(signedIn, [uri]);
    if (view?.record?.reply?.root?.uri !== root) return answer({ error: "not-allowed" }, 400);
    const rkey = rkeyOf(root);
    let existing: { cid?: string; value?: Record<string, unknown> } = {};
    try {
      existing = await call(signedIn, "com.atproto.repo.getRecord", {
        query: new URLSearchParams({ repo: signedIn.did, collection: "app.bsky.feed.threadgate", rkey }).toString(),
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "RecordNotFound") throw error;
    }
    const value = existing.value ?? {};
    const hidden = new Set([...((value.hiddenReplies as string[] | undefined) ?? []), uri]);
    await call(signedIn, "com.atproto.repo.putRecord", {
      body: {
        repo: signedIn.did,
        collection: "app.bsky.feed.threadgate",
        rkey,
        // Who may reply (`allow`) stays as it was.
        record: {
          ...value,
          $type: "app.bsky.feed.threadgate",
          post: root,
          hiddenReplies: [...hidden],
          createdAt: (value.createdAt as string | undefined) ?? new Date().toISOString(),
        },
        ...(existing.cid && { swapRecord: existing.cid }),
      },
    });
    refreshThread(root);
    return answer({ hidden: uri });
  } catch (error) {
    return failed(error, "hide");
  }
}

/** Whether the reader follows `subject` (one of the site's accounts): the follow record's AT URI, or "". */
async function followRecord(did: string, subject: string): Promise<string> {
  const response = await fetch(`${base}/following?${new URLSearchParams({ actor: did, subject })}`);
  if (!response.ok) throw new Error(`following ${response.status}`);
  return ((await response.json()) as { following?: string }).following ?? "";
}

/** Whether the signed-in reader follows `subject`; null if that can't be told. */
export async function following(subject: string): Promise<boolean | null> {
  const current = await session();
  if (!current) return null;
  try {
    return !!(await followRecord(current.did, subject));
  } catch {
    return null;
  }
}

// Follows (or unfollows) one of the site's own accounts. Never yourself.
async function follow(body: { subject?: unknown; on?: unknown }) {
  const signedIn = await reader();
  if (signedIn instanceof Response) return signedIn;
  const { subject, on } = body;
  if (typeof subject !== "string" || !settings.allowedAuthors.includes(subject) || subject === signedIn.did || typeof on !== "boolean") {
    return answer({ error: "not-allowed" }, 400);
  }
  if (!allows(signedIn, "app.bsky.graph.follow", on ? "create" : "delete")) return needs("follow");
  try {
    const existing = await followRecord(signedIn.did, subject);
    if (on && !existing) {
      await createRecord(signedIn, "app.bsky.graph.follow", { $type: "app.bsky.graph.follow", subject, createdAt: new Date().toISOString() });
    } else if (!on && existing) {
      await deleteRecord(signedIn, existing);
    }
    return answer({ following: on });
  } catch (error) {
    return failed(error, "follow");
  }
}

/** Whether the reader has liked or reposted these posts (those in the site's threads). */
export async function state(uris: string[]) {
  const signedIn = await reader();
  if (signedIn instanceof Response) return signedIn;
  try {
    const views = await postsAsReader(signedIn, [...new Set(uris)].filter(isPostUri).slice(0, 100));
    const posts: Record<string, { liked: boolean; reposted: boolean }> = {};
    for (const view of views) {
      if (inSiteThread(view)) posts[view.uri] = { liked: !!view.viewer?.like, reposted: !!view.viewer?.repost };
    }
    return answer({ posts });
  } catch (error) {
    return failed(error, "state");
  }
}

/** Signs out: cancels the sign-in at the reader's account host, and deletes it from this browser. */
export async function signOut() {
  const current = await session().catch(() => null);
  remember("");
  sessionPromise = Promise.resolve(null);
  profilePromise = undefined;
  try {
    await current?.signOut();
  } catch (error) {
    console.warn("[atmosphere] sign-out:", error instanceof Error ? error.message : error);
  }
  return answer({ signedIn: false });
}

/** What the comments and reactions send, answered as the old routes did. */
export function send(path: string, body: unknown): Promise<Response> {
  const actions: Record<string, (body: never) => Promise<Response>> = { comment, react, delete: remove, hide, follow };
  const action = actions[path];
  return action ? action(body as never) : Promise.resolve(answer({ error: "bad-request" }, 400));
}

const HANDLE = /^(did:[a-z0-9:._%-]+|[a-z0-9.-]+\.[a-z0-9-]+)$/;

/**
 * Sends the reader to their account host to approve `permissions` (default:
 * posting, liking and reposting), coming back to `returnTo`. A new approval
 * replaces the old one, so whatever the same account already allowed is
 * asked for again too. If the account can't be found, the reader is sent
 * to `returnTo` with ?atmosphere=<problem>, as the comments expect.
 */
export async function signIn(input: string, options: { permissions?: Permission[]; returnTo?: string; lang?: string } = {}) {
  const returnTo = safeReturnPath(options.returnTo ?? `${location.pathname}${location.search}${location.hash}`);
  const handle = input.trim().replace(/^@/, "").toLowerCase();
  if (!handle || handle.length > 253 || !HANDLE.test(handle)) return location.assign(withStatus(returnTo, "invalid-handle"));
  const permissions = new Set<Permission>(options.permissions?.length ? options.permissions : DEFAULT_PERMISSIONS);
  try {
    const current = await session();
    if (current && current.did === handle) {
      for (const name of grantedPermissions((await current.getTokenInfo(false)).scope.split(" "))) permissions.add(name);
    }
  } catch {
    // Not signed in any more: just what's asked for.
  }
  try {
    const url = await (await client()).authorize(handle, {
      scope: scopeFor(permissions),
      state: JSON.stringify({ returnTo }),
      ...(options.lang && { ui_locales: options.lang }),
    });
    location.assign(url.href);
  } catch (error) {
    console.warn("[atmosphere] sign-in could not start:", error instanceof Error ? error.message : error);
    location.assign(withStatus(returnTo, "account-not-found"));
  }
}

/** Signs in with a sign-in form (SignInForm.astro): its handle box, return address and any permission fields. */
export function handleSignInForm(form: HTMLFormElement, lang?: string) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    void signIn(String(data.get("handle") ?? ""), {
      permissions: data.getAll("permission").map(String) as Permission[],
      returnTo: String(data.get("returnTo") ?? ""),
      lang,
    }).finally(() => {
      // Back from the account host with the browser's back button.
      window.setTimeout(() => button && (button.disabled = false), 1000);
    });
  });
  // Pages restored from the back-forward cache keep a disabled button otherwise.
  window.addEventListener("pageshow", () => form.querySelector<HTMLButtonElement>('button[type="submit"]')?.removeAttribute("disabled"));
}

/** On the callback page: finishes signing in, then back to the page the reader was on. */
export async function finishSignIn() {
  let returnTo = "/";
  const back = (value: unknown) => {
    try {
      returnTo = safeReturnPath((JSON.parse(String(value)) as { returnTo?: unknown }).returnTo);
    } catch {
      // Back to the home page.
    }
  };
  try {
    const { session: signedIn, state: value } = await (await client()).initCallback(undefined, callbackUrl() as `https://${string}`);
    remember(signedIn.did);
    back(value);
    location.replace(withStatus(returnTo, "signed-in"));
  } catch (error) {
    // The reader declined, took too long, or something went wrong. The
    // library's error still carries our state, so they can go back.
    back((error as { state?: unknown }).state);
    console.warn("[atmosphere] sign-in failed:", error instanceof Error ? error.message : error);
    location.replace(withStatus(returnTo, "sign-in-failed"));
  }
}
