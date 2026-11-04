// The comment box's behaviour: counting characters, @mention suggestions,
// posting (as a reply, or a quote post), and the quote preview. Used by
// AtmosphereComments (its main box and every reply box) and by the reply and
// quote overlay of AtmosphereReactions. The markup is Composer.astro.
import { send } from "./account";

export const MAX = 300; // Bluesky's limit for a post, in characters as people count them
const graphemes = new Intl.Segmenter();
export const count = (text: string) => [...graphemes.segment(text.trim())].length;

export type Suggestion = { handle: string; displayName?: string; avatar?: string };
export type Person = { did: string; handle: string; displayName?: string; avatar?: string };
/** What posting a comment (lib/client/account.ts) answers with. */
export type Posted = {
  uri: string;
  url: string;
  quote: boolean;
  text: string;
  createdAt: string;
  parent: string | null;
  author: Person;
};

export type ComposerContext = {
  base: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** The wording for an error code from the routes. */
  message: (code: string) => string;
  setAvatar: (slot: HTMLElement, name: string, src?: string) => void;
};

export type ComposerBehaviour = {
  /** The post being replied to or quoted (the announcement, or another post by the site's accounts). */
  root: () => string;
  /** More for posting: { parent } for a reply to a comment, { quote: true } for a quote post. */
  extra: () => Record<string, unknown>;
  tell: (message: string) => void;
  onPosted: (data: Posted) => void;
  /** `permission`, with "needs-permission": the one the reader hasn't given yet. */
  onError: (code: string, tell: (message: string) => void, permission?: string) => void;
  onInput?: () => void;
};

export function setUpComposer(form: HTMLFormElement, ctx: ComposerContext, behaviour: ComposerBehaviour) {
  const textarea = form.querySelector("textarea")!;
  const counter = form.querySelector<HTMLElement>("[data-count]")!;
  const submit = form.querySelector<HTMLButtonElement>("[data-submit]")!;
  const suggestions = form.querySelector<HTMLUListElement>("[data-suggestions]")!;

  const updateCount = () => {
    const used = count(textarea.value);
    counter.textContent = used > MAX - 50 ? ctx.t("composer.charactersLeft", { count: MAX - used }) : "";
    counter.classList.toggle("is-over", used > MAX);
  };

  // @mention suggestions, as in the Bluesky app: typing @ and the start
  // of a handle or name lists matching accounts to choose from.
  let options: Suggestion[] = [];
  let active = -1;
  let lookup: number | undefined;
  let latestQuery = "";
  const mentionAtCaret = () => {
    const before = textarea.value.slice(0, textarea.selectionStart);
    const match = /(?:^|[\s(])@([a-zA-Z0-9.-]{1,64})$/.exec(before);
    return match ? { query: match[1], start: before.length - match[1].length - 1 } : null;
  };
  const closeSuggestions = () => {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    options = [];
    active = -1;
    textarea.setAttribute("aria-expanded", "false");
    textarea.removeAttribute("aria-activedescendant");
  };
  const highlight = (index: number) => {
    active = index;
    suggestions.querySelectorAll("li").forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
    if (index >= 0) textarea.setAttribute("aria-activedescendant", `${suggestions.id}-option-${index}`);
  };
  const choose = (index: number) => {
    const mention = mentionAtCaret();
    const option = options[index];
    if (!mention || !option) return closeSuggestions();
    const after = textarea.value.slice(textarea.selectionStart);
    textarea.value = `${textarea.value.slice(0, mention.start)}@${option.handle} ${after}`;
    const caret = mention.start + option.handle.length + 2;
    textarea.setSelectionRange(caret, caret);
    closeSuggestions();
    textarea.focus();
    updateCount();
    behaviour.onInput?.();
  };
  const showSuggestions = (found: Suggestion[]) => {
    options = found;
    if (!found.length) return closeSuggestions();
    suggestions.replaceChildren(
      ...found.map((option, index) => {
        const item = document.createElement("li");
        item.id = `${suggestions.id}-option-${index}`;
        item.setAttribute("role", "option");
        const avatar = document.createElement("span");
        avatar.className = "atmo__avatar atmo__avatar--small";
        ctx.setAvatar(avatar, option.displayName || option.handle, option.avatar);
        const name = Object.assign(document.createElement("strong"), { textContent: option.displayName || option.handle });
        const handle = Object.assign(document.createElement("span"), { textContent: `@${option.handle}` });
        item.append(avatar, name, handle);
        // mousedown keeps the focus in the text box.
        item.addEventListener("mousedown", (event) => event.preventDefault());
        item.addEventListener("click", () => choose(index));
        return item;
      }),
    );
    suggestions.hidden = false;
    textarea.setAttribute("aria-expanded", "true");
    highlight(0);
  };
  const lookUpMention = () => {
    window.clearTimeout(lookup);
    const mention = mentionAtCaret();
    if (!mention) return closeSuggestions();
    latestQuery = mention.query;
    lookup = window.setTimeout(async () => {
      const query = mention.query;
      try {
        const response = await fetch(`${ctx.base}/typeahead?q=${encodeURIComponent(query)}`, { credentials: "same-origin" });
        const data = (await response.json()) as { actors?: Suggestion[] };
        if (query === latestQuery) showSuggestions(data.actors ?? []);
      } catch {
        closeSuggestions();
      }
    }, 200);
  };

  textarea.addEventListener("input", () => {
    updateCount();
    behaviour.onInput?.();
    lookUpMention();
  });
  textarea.addEventListener("keydown", (event) => {
    if (suggestions.hidden) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      highlight((active + step + options.length) % options.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      choose(Math.max(active, 0));
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
    }
  });
  textarea.addEventListener("blur", () => window.setTimeout(closeSuggestions, 150));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    if (count(text) > MAX) return behaviour.tell(ctx.message("too-long"));
    submit.disabled = true;
    behaviour.tell(ctx.t("composer.posting"));
    try {
      const response = await send("comment", { text, root: behaviour.root(), ...behaviour.extra() });
      const data = await response.json();
      if (!response.ok) return behaviour.onError(data.error, behaviour.tell, data.permission);
      textarea.value = "";
      updateCount();
      behaviour.onPosted(data);
    } catch {
      behaviour.tell(ctx.message("error"));
    } finally {
      submit.disabled = false;
    }
  });

  return { textarea, updateCount };
}

/**
 * The quote preview inside a box: the reader's words as they type, with the
 * post being quoted beneath, as Bluesky will show it. Call update() as they
 * type and load(uri) when quoting starts.
 */
export function quotePreview(form: HTMLFormElement, textarea: HTMLTextAreaElement, ctx: ComposerContext) {
  const $ = <T extends Element>(selector: string) => form.querySelector<T>(selector)!;
  const previewText = $<HTMLElement>("[data-preview-text]");
  let loaded = "";
  const update = () => {
    const words = textarea.value.trim();
    previewText.textContent = words || ctx.t("composer.previewEmpty");
    previewText.classList.toggle("is-placeholder", !words);
  };
  const load = async (uri: string) => {
    update();
    if (loaded === uri) return;
    try {
      const response = await fetch(`${ctx.base}/post?uri=${encodeURIComponent(uri)}`);
      if (!response.ok) return;
      const quoted = (await response.json()) as {
        author: { handle: string; displayName?: string; avatar?: string };
        text: string;
        external?: { uri: string; title: string; description: string; thumb?: string };
      };
      loaded = uri;
      const quotedName = quoted.author.displayName || quoted.author.handle;
      $<HTMLElement>("[data-quoted-name]").textContent = quotedName;
      ctx.setAvatar($<HTMLElement>("[data-quoted-avatar]"), quotedName, quoted.author.avatar);
      $<HTMLElement>("[data-quoted-handle]").textContent = `@${quoted.author.handle}`;
      $<HTMLElement>("[data-quoted-text]").textContent = quoted.text;
      const card = $<HTMLElement>("[data-card]");
      card.hidden = !quoted.external;
      if (quoted.external) {
        $<HTMLElement>("[data-card-title]").textContent = quoted.external.title;
        $<HTMLElement>("[data-card-description]").textContent = quoted.external.description;
        $<HTMLElement>("[data-card-domain]").textContent = new URL(quoted.external.uri).hostname;
        const img = $<HTMLImageElement>("[data-card-image]");
        img.hidden = true;
        if (quoted.external.thumb) {
          img.onload = () => (img.hidden = false);
          img.onerror = () => (img.hidden = true);
          img.src = quoted.external.thumb;
        }
      }
    } catch {
      // The preview is a nicety: quoting still works without it.
    }
  };
  return { update, load };
}
