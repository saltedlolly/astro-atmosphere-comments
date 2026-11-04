// Matching accounts under a sign-in form's handle box as the reader types,
// with their avatars, so they can see they've found the right one. Picking one
// signs in with it. Without JavaScript the box works as a plain text box.
// Used by AtmosphereComments and AtmosphereReactions (see SignInForm.astro).

type Suggestion = { handle: string; displayName?: string; avatar?: string };

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

// An avatar picture, or the name's first letter if there isn't one.
const setAvatar = (slot: HTMLElement, name: string, src?: string) => {
  slot.textContent = name.trim().charAt(0).toUpperCase();
  if (!src) return;
  const img = Object.assign(document.createElement("img"), { src, alt: "" });
  img.onload = () => slot.replaceChildren(img);
};

/** Adds the suggestions to a SignInForm's handle box. `base` is where the integration's routes live. */
export function enhanceHandleBox(form: HTMLFormElement, base: string) {
  const input = form.querySelector<HTMLInputElement>('input[name="handle"]')!;
  const list = form.querySelector<HTMLUListElement>("[data-handle-suggestions]")!;
  let found: Suggestion[] = [];
  let active = -1;
  let latest = "";
  let timer: number | undefined;
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");

  const close = () => {
    list.hidden = true;
    list.replaceChildren();
    found = [];
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const highlight = (index: number) => {
    active = index;
    list.querySelectorAll("li").forEach((item, i) => item.setAttribute("aria-selected", String(i === index)));
    if (index >= 0) input.setAttribute("aria-activedescendant", `${list.id}-option-${index}`);
    else input.removeAttribute("aria-activedescendant");
  };
  const choose = (index: number) => {
    const option = found[index];
    if (!option) return;
    input.value = option.handle;
    close();
    form.requestSubmit();
  };
  const show = (actors: Suggestion[]) => {
    found = actors.slice(0, 5);
    if (!found.length || document.activeElement !== input) return close();
    list.replaceChildren(
      ...found.map((option, index) => {
        const item = make("li");
        item.id = `${list.id}-option-${index}`;
        item.setAttribute("role", "option");
        const avatar = make("span", "atmo__avatar atmo__avatar--small");
        avatar.setAttribute("aria-hidden", "true");
        setAvatar(avatar, option.displayName || option.handle, option.avatar);
        item.append(avatar, make("strong", "", option.displayName || option.handle), make("span", "", `@${option.handle}`));
        // mousedown keeps the focus in the handle box.
        item.addEventListener("mousedown", (event) => event.preventDefault());
        item.addEventListener("click", () => choose(index));
        return item;
      }),
    );
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    // Nothing is picked until the reader chooses, so Enter still signs in
    // with exactly what they typed.
    highlight(-1);
  };

  input.addEventListener("input", () => {
    window.clearTimeout(timer);
    const query = input.value.trim().replace(/^@/, "");
    latest = query;
    if (query.length < 2 || query.startsWith("did:") || /\s/.test(query)) return close();
    timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${base}/typeahead?q=${encodeURIComponent(query)}`, { credentials: "same-origin" });
        const data = (await response.json()) as { actors?: Suggestion[] };
        if (query === latest) show(data.actors ?? []);
      } catch {
        close();
      }
    }, 250);
  });
  input.addEventListener("keydown", (event) => {
    if (list.hidden) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      highlight(active < 0 && step < 0 ? found.length - 1 : (active + step + found.length) % found.length);
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });
  input.addEventListener("blur", () => window.setTimeout(close, 150));
}
