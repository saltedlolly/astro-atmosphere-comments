// The component's wording in each language. The files in locales/ are
// i18next JSON (v4): flat keys, {{placeholders}}, and plural forms as
// key_one, key_other (and key_few, key_many… where a language needs them).
// English is the source; translations are made in Weblate, which commits them
// back to the repository. Any key a language lacks falls back to English.

import type { Messages } from "./translate";

export type { Messages } from "./translate";
export { translate, translateHtml } from "./translate";

const files = import.meta.glob<Messages>("../locales/*.json", { eager: true, import: "default" });
const LOCALES: Record<string, Messages> = Object.fromEntries(
  Object.entries(files).map(([path, messages]) => [path.replace(/^.*\/|\.json$/g, ""), messages]),
);

/** The best language we have for `wanted` ("pt-BR" → "pt-BR", else "pt", else "en"). */
export function pickLocale(...wanted: Array<string | undefined>): string {
  for (const tag of wanted) {
    if (!tag) continue;
    const exact = Object.keys(LOCALES).find((code) => code.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const base = tag.split("-")[0].toLowerCase();
    if (LOCALES[base]) return base;
  }
  return "en";
}

/** English, with the language's own wording on top, then the site's overrides. */
export function messagesFor(locale: string, overrides: Messages = {}): Messages {
  return { ...LOCALES.en, ...(LOCALES[locale] ?? {}), ...overrides };
}
