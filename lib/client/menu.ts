// The ⌄ menu beside Subscribe and beside Follow: opens and closes on a click,
// a click elsewhere, or Escape. `root` holds both the ⌄ button
// ([data-menu-more]) and the menu ([data-menu]).
export function setUpMenu(root: HTMLElement) {
  const more = root.querySelector<HTMLButtonElement>("[data-menu-more]");
  const menu = root.querySelector<HTMLElement>("[data-menu]");
  if (!more || !menu || root.dataset.ready !== undefined) return;
  root.dataset.ready = "";
  const setMenu = (open: boolean) => {
    menu.hidden = !open;
    more.setAttribute("aria-expanded", String(open));
  };
  more.addEventListener("click", () => {
    setMenu(menu.hidden);
    if (!menu.hidden) menu.querySelector<HTMLElement>("a:not([hidden]), button")?.focus();
  });
  document.addEventListener("click", (event) => {
    if (!root.contains(event.target as Node)) setMenu(false);
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setMenu(false);
      more.focus();
    }
  });
}
