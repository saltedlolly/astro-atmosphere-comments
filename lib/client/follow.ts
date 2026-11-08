// Following the site's own accounts: whether the reader follows each, shared
// by every Follow button on the page (AtmosphereReactions' and the one under
// each post in AtmosphereComments), so they all agree. Each component draws
// its own buttons and offers signing in its own way; this keeps the state.
import { following, send } from "./account";

type Listener = (on: boolean) => void;
type Entry = { on: boolean; busy: boolean; buttons: Set<HTMLButtonElement>; listeners: Set<Listener>; checked?: Promise<void> };

const entries = new Map<string, Entry>();

const entry = (subject: string): Entry => {
  let found = entries.get(subject);
  if (!found) {
    found = { on: false, busy: false, buttons: new Set(), listeners: new Set() };
    entries.set(subject, found);
  }
  return found;
};

const set = (subject: string, on: boolean) => {
  const found = entry(subject);
  found.on = on;
  found.listeners.forEach((listener) => listener(on));
};

/** Keeps `button` up to date for `subject`: `listener` is called now and whenever it changes. */
export function watchFollow(subject: string, button: HTMLButtonElement, listener: Listener) {
  const found = entry(subject);
  found.buttons.add(button);
  found.listeners.add(listener);
  listener(found.on);
}

/** Whether the signed-in reader follows `subject`, asked once a page. */
export function loadFollowing(subject: string): Promise<void> {
  const found = entry(subject);
  found.checked ??= following(subject).then((known) => {
    if (known !== null) set(subject, known);
  });
  return found.checked;
}

export const isFollowing = (subject: string) => entry(subject).on;

/** After signing out here: nobody is followed any more, as far as the page knows. */
export function forgetFollowing() {
  for (const [subject, found] of entries) {
    found.checked = undefined;
    set(subject, false);
  }
}

/**
 * Follows `subject`, or unfollows if the reader already does. Says what
 * happened, so the caller can offer signing in or another permission.
 */
export async function pressFollow(subject: string): Promise<"done" | "signed-out" | "needs-permission" | "error"> {
  const found = entry(subject);
  if (found.busy) return "done";
  found.busy = true;
  found.buttons.forEach((each) => (each.disabled = true));
  try {
    const response = await send("follow", { subject, on: !found.on });
    const data = (await response.json().catch(() => ({}))) as { following?: boolean; error?: string };
    if (response.ok) {
      set(subject, !!data.following);
      return "done";
    }
    if (data.error === "signed-out" || data.error === "needs-permission") return data.error;
    return "error";
  } catch {
    return "error";
  } finally {
    found.busy = false;
    found.buttons.forEach((each) => (each.disabled = false));
  }
}

let taken = false;

/**
 * Back from signing in (or approving following) after pressing Follow: the
 * account they asked to follow, from #atmo-follow=<DID>, if `mine` says the
 * caller has a button for it. Taken once a page (so two components never
 * both act on it), tidying the address. Null if none.
 */
export function takePendingFollow(mine: (subject: string) => boolean): string | null {
  if (taken) return null;
  const pending = location.hash.match(/^#atmo-follow=(.+)$/);
  if (!pending || !mine(decodeURIComponent(pending[1]))) return null;
  taken = true;
  const url = new URL(location.href);
  if (!document.querySelector("atmosphere-comments")) url.searchParams.delete("atmosphere");
  history.replaceState(history.state, "", `${url.pathname}${url.search}`);
  return decodeURIComponent(pending[1]);
}
