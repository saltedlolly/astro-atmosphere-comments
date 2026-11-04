// Filling in the component's wording: placeholders and plural forms. Kept
// apart from lib/i18n.ts so the browser script can use it without bundling
// every language.

export type Messages = Record<string, string>;

/**
 * One piece of wording: `vars` fill its {{placeholders}}, and a `count`
 * picks the plural form the language needs. Placeholders not given are
 * left as they are (the component fills some with links).
 */
export function translate(messages: Messages, locale: string, key: string, vars: Record<string, string | number> = {}): string {
  let text = messages[key];
  if (typeof vars.count === "number") {
    const form = new Intl.PluralRules(locale).select(vars.count);
    text = messages[`${key}_${form}`] ?? messages[`${key}_other`] ?? text;
  }
  text ??= key;
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Like translate, for markup: the wording is escaped, and `html` fills placeholders with markup (links, say). */
export function translateHtml(
  messages: Messages,
  locale: string,
  key: string,
  html: Record<string, string>,
  vars: Record<string, string | number> = {},
): string {
  return escapeHtml(translate(messages, locale, key, vars)).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in html ? html[name] : match,
  );
}
