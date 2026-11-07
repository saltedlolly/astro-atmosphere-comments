// Subscribe / Subscribed buttons (marked data-atmosphere-subscribe): the panel
// under a post and any others a site places. Each component looks after its
// own buttons and how it offers signing in; what the reader's subscription is
// lives here, so every button on the page agrees.
//
// Signing in asks for this along with everything else, so there's never a
// second trip to the reader's account host for it.
import { canSubscribe, send, subscribed } from "./account";

type Translate = (key: string, vars?: Record<string, string | number>) => string;
/** Offers the sign-in form, coming back to #atmo-subscribe; `problem` says why it's needed again. */
type AskToSignIn = (problem?: string) => void;

const SIGN_IN_PROBLEMS: Record<string, string> = {
  "sign-in-failed": "messages.signInFailed",
  "account-not-found": "messages.accountNotFound",
  "invalid-handle": "messages.invalidHandle",
};

const buttons = new Map<HTMLButtonElement, Translate>();
let isSubscribed = false;
let loaded: Promise<boolean | null> | undefined;

const render = () => {
  for (const [button, t] of buttons) {
    button.title = t(isSubscribed ? "subscribe.subscribedLabel" : "subscribe.subscribeLabel");
    // A label to fill in; without one, the button keeps what the site put in
    // it (and shows the state with [aria-pressed]), so it needs its full name.
    const label = button.querySelector("[data-atmosphere-subscribe-label]");
    if (label) label.textContent = t(isSubscribed ? "subscribe.subscribed" : "subscribe.subscribe");
    else button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(isSubscribed));
    button.hidden = false;
  }
};

/** Whether the reader subscribes, asked once a page; null if they aren't signed in. */
export function loadSubscribed(): Promise<boolean | null> {
  loaded ??= subscribed().then((found) => {
    isSubscribed = !!found;
    render();
    return found;
  });
  return loaded;
}

/** After signing out here. */
export function forgetSubscribed() {
  loaded = undefined;
  isSubscribed = false;
  render();
}

async function press(button: HTMLButtonElement, t: Translate, ask: AskToSignIn) {
  for (const each of buttons.keys()) each.disabled = true;
  let problem = "";
  try {
    const response = await send("subscribe", { on: !isSubscribed });
    const data = (await response.json().catch(() => ({}))) as { subscribed?: boolean; error?: string };
    if (response.ok) isSubscribed = !!data.subscribed;
    else if (data.error === "signed-out") ask();
    else problem = t("messages.error");
  } catch {
    problem = t("messages.error");
  }
  for (const each of buttons.keys()) each.disabled = false;
  render();
  // Said beside the button, as the page may be showing nothing else.
  document.querySelectorAll(".atmo-subscribe-problem").forEach((part) => part.remove());
  if (problem) {
    const note = Object.assign(document.createElement("span"), { className: "atmo-subscribe-problem", textContent: problem });
    note.setAttribute("role", "status");
    button.after(note);
  }
}

/** Shows these buttons, if the site has a publication to subscribe to. */
export function addSubscribeButtons(list: HTMLButtonElement[], t: Translate, ask: AskToSignIn) {
  if (!canSubscribe()) return;
  for (const button of list) {
    buttons.set(button, t);
    button.addEventListener("click", () => void press(button, t, ask));
  }
  render();
}

let finished = false;

/** Back from signing in after pressing Subscribe: subscribes, as they asked. */
export async function finishPendingSubscribe(t: Translate, ask: AskToSignIn) {
  if (finished || location.hash !== "#atmo-subscribe") return;
  finished = true;
  const url = new URL(location.href);
  const code = url.searchParams.get("atmosphere") ?? "";
  if (!document.querySelector("atmosphere-comments")) url.searchParams.delete("atmosphere");
  history.replaceState(history.state, "", `${url.pathname}${url.search}`);
  const known = await loadSubscribed();
  if (known === null) {
    if (SIGN_IN_PROBLEMS[code]) ask(t(SIGN_IN_PROBLEMS[code]));
    return;
  }
  const [first] = buttons.keys();
  if (!first) return;
  first.scrollIntoView({ block: "center" });
  if (!known) await press(first, t, ask);
}
