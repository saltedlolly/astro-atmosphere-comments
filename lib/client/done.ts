// A brief "Liked" or "Reposted" over a button, with its icon enlarged and
// popping, when something the reader pressed before signing in is finished
// once they're back: otherwise the only sign is a small change of colour,
// easy to miss after a trip to their account host. Styles: .atmo-done in
// atmosphere.css (with a plain fade for readers who ask for less motion).

/** Shows the bubble over `button` now. */
export function showDone(button: HTMLElement, label: string) {
  button.querySelector(":scope > .atmo-done")?.remove();
  const bubble = document.createElement("span");
  bubble.className = "atmo-done";
  // Screen readers already hear the component's own status line.
  bubble.setAttribute("aria-hidden", "true");
  const icon = button.querySelector("svg")?.cloneNode(true) as SVGElement | undefined;
  if (icon) {
    icon.removeAttribute("class");
    icon.classList.add("atmo-done__icon");
    bubble.append(icon);
  }
  bubble.append(Object.assign(document.createElement("span"), { className: "atmo-done__label", textContent: label }));
  button.classList.add("atmo-has-done");
  button.append(bubble);
  const finish = () => {
    bubble.remove();
    if (!button.querySelector(":scope > .atmo-done")) button.classList.remove("atmo-has-done");
  };
  bubble.addEventListener("animationend", (event) => {
    if (event.target === bubble) finish();
  });
  // In case animations don't run (a hidden tab, say).
  window.setTimeout(finish, 3000);
}

/**
 * Shows the bubble after `button` is pressed, once its request has finished
 * (the component marks it `data-busy` meanwhile) and only if it's still
 * pressed (aria-pressed="true"), so it appears only when the like or repost
 * actually went through. Call it just before pressing. Gives up after
 * `timeout` milliseconds.
 */
export function showDoneWhenPressed(button: HTMLElement, label: string, timeout = 20000) {
  let started = false;
  const observer = new MutationObserver(() => {
    if ("busy" in button.dataset) {
      started = true;
      return;
    }
    if (!started) return;
    observer.disconnect();
    if (button.getAttribute("aria-pressed") === "true") showDone(button, label);
  });
  observer.observe(button, { attributes: true, attributeFilter: ["data-busy", "aria-pressed"] });
  window.setTimeout(() => observer.disconnect(), timeout);
}
