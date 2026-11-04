# Working on Atmosphere Comments for Astro

Notes for anyone changing this package, people and coding agents alike. What the package does and how to use it is in [README.md](README.md); this file covers how it's built and the conventions to keep.

It is maintained by [Olly Stedall](https://saltedlolly.com) and used live on [saltedlolly.com](https://saltedlolly.com), so changes are released only after they've been tried there.

## Layout

| Path | What it is |
| --- | --- |
| `index.mjs`, `index.d.ts` | The Astro integration: checks the options, adds the routes, and passes the settings to the routes and component through a virtual module (`virtual:atmosphere-comments/settings`, read by `lib/settings.ts`). |
| `components/Composer.astro` | The comment box ("Comment as", the text box with @mention suggestions, the quote preview, the count and Post). Markup only: its behaviour is `lib/client/composer.ts`, its styles `atmosphere.css`. Used under posts (and cloned for reply boxes) and in the reply and quote overlay. |
| `components/atmosphere.css` | The shared, global styles for the comments, the comment box and the thread (every class starts with `atmo`; the thread's defaults are `:where`, so sites win). |
| `components/SignInForm.astro` | The sign-in form (handle box with account suggestions, the Sign in with Atmosphere button). Shared by the two components below; ids are prefixed by its `id` prop so both can be on one page. |
| `components/AtmosphereReactions.astro` | Reply, Repost, Quote and Like under any element marked `data-atmosphere-post` (a site's feed of its Bluesky posts), and the sign-in overlay for readers who aren't signed in; also the reader's avatar and account menu in any element marked `data-atmosphere-account`. Placed once in a site's layout. |
| `lib/client/` | Browser code shared by the components: the account suggestions under the handle box (`handle-suggestions.ts`) and the comment box (`composer.ts`). |
| `components/AtmosphereComments.astro` | The component under each post: the sign-in form, the comment box, Like, Repost and Quote, and the thread (likes, reposts and nested comments, drawn in the browser). One file, with its script and styles. |
| `routes/` | The server routes, under `/atmosphere` by default (`login`, `callback`, `logout`, `me`, `comment`, `react`, `delete`, `state`, `thread`, `typeahead`, `media`, `post`, plus `jwks.json`). Each one is listed in `ROUTES` in `index.mjs`. The client metadata is the exception: it's served at the site's root, `/oauth-client-metadata.json`, because Bluesky's approval page names an app by its address alone only when its metadata is there (otherwise it shows the full file address). |
| `lib/` | Shared server code: OAuth (`oauth.ts`), the signed-in reader and their permissions (`reader.ts`), the thread (`thread.ts`), stores, profiles, rich text. |
| `bin/cli.mjs` | `npx astro-atmosphere-comments keygen`: creates the site's signing key. |
| `locales/` | The wording, one i18next JSON file per language (see "Wording and translations"). |
| `assets/` | The Atmosphere Account logo (MIT, © 2026 Joseph Basser; its licence is beside it). |

## Ground rules

- **Readers sign in straight to their own account host** with AT Protocol OAuth. No third-party login service sits in between, and the site never sees a password.
- **Ask for as little as possible.** Signing in asks only to create posts, to create and delete likes and reposts, and to read posts as the reader sees them (`SCOPE` in `lib/oauth.ts`). Permission to delete posts (`DELETE_SCOPE`) and to follow (`FOLLOW_SCOPE`) are asked for separately, the first time a reader deletes a comment or presses Follow; `routes/login.ts` keeps any extra permission already granted, since a new approval replaces the old one. Any new permission must be added to the client metadata (`ALL_SCOPES`), and readers who signed in without it must be handled gracefully (see `reader()` in `lib/reader.ts`).
- **A permission can only name a kind of record, not particular posts**, so the routes enforce the real limits. Every route that changes something:
  - uses `reader()`, which checks that the request came from the site (`Origin`), is JSON, and has a signed-in reader with the right permissions;
  - acts only on the site's announcements and posts in their threads (`isSitePost`, `inSiteThread`); deleting is limited further, to the reader's own replies under an announcement;
  - is rate-limited per account.
- **Readers' browsers never talk to Bluesky directly.** Avatars and link-card pictures go through `routes/media.ts`, which passes on only images it has just shown. Account searches go through `routes/typeahead.ts`: limited per account for signed-in readers, and per address plus an overall cap for everyone else (behind a proxy every visitor may share one address), with answers remembered for a minute, so the site can't be used to flood Bluesky's search.
- **Store only what's needed** (each reader's DID and OAuth tokens, a random cookie value), in files only the site's user can read.
- **Comments are plain text.** Links, @mentions and #hashtags become links; nothing else is rendered as HTML.

## The sign-in form's handle field (provisional)

There is no agreed convention yet for marking up the box where someone types their Atmosphere handle, so this package follows the one the community seems to be converging on. **Expect this to change** if the community settles on something different, such as a different field name or a proper HTML autofill type for handles. When that happens, update the field to match.

What it uses now, and why:

- **`name="handle"`**: the name most atproto apps now use for this box, so browsers can suggest handles a reader typed on other sites. `routes/login.ts` reads the same name (`form.get("handle")`), so change both together.
- **No `autocomplete` value.** `autocomplete="username"` (which some apps use) makes password managers treat the box as a login for the site it's on, and offer the wrong account on sites that have their own login. `autocomplete="off"` would stop the browser suggesting handles typed elsewhere.
- **Password managers are asked to ignore the box**: `data-1p-ignore` (1Password), `data-lpignore="true"` (LastPass), `data-bwignore` (Bitwarden) and `data-form-type="other"` (Dashlane). There's no vendor-neutral way to say this yet.
- `type="text"` with `inputmode="url"`, `autocapitalize="none"` and `spellcheck="false"`, so phone keyboards suit a handle.
- With JavaScript, the box becomes a combobox (`role="combobox"`, `aria-controls`, `aria-activedescendant`) that suggests matching accounts with their avatars, from `routes/typeahead.ts`. Nothing is picked until the reader chooses, so Enter signs in with exactly what they typed.

The discussion so far:

- [A plea: a convention for `<input name="handle">`](https://discourse.atmosphere.community/t/a-plea-a-convention-for-input-name-handle/644) (Atmosphere Community, from March 2026)
- [Ways that the browser can change to help atproto succeed?](https://discourse.atmosphere.community/t/ways-that-the-browser-can-change-to-help-atproto-succeed/463) (Atmosphere Community: WHATWG autofill, password managers, FedCM)

If you change the field, say so in `CHANGELOG.md`, because sites may style or script it.

## Wording and translations

- **All wording lives in `locales/`**, one file per language (`en.json`, `fr.json`…), in i18next JSON v4: flat keys such as `signIn.heading`, `{{placeholders}}`, and plural forms as `key_one`, `key_other` (plus `_few`, `_many`… where a language needs them, per `Intl.PluralRules`). Never write user-visible English directly in the component or routes.
- **English (`en.json`) is the source.** To add or change wording, edit `en.json` only, and use it with `t("key")` (script) or `t()` / `th()` (the component's server part). Links inside a sentence are placeholders (`{{link}}`) filled with markup by `th()`, so translators can move them.
- **Other languages are to be translated on Weblate** (Hosted Weblate project `astro-atmosphere-comments`, requested November 2026), which will commit them back here as pull requests. Once Weblate manages them, don't edit the other language files by hand: changes would clash with Weblate's. A new English key shows up in Weblate for translators; until it's translated, English is shown.
- `lib/i18n.ts` loads the files and picks the language (server only); `lib/translate.ts` fills in placeholders and plurals, and is the only part the browser script imports, so a page ships one language, as JSON in `data-messages`.
- The starting translations of French, German, Spanish, Portuguese, Italian, Dutch and Japanese were drafted by an AI model and are marked for review in Weblate.

## The credit link and saying thanks

- The component ends with a small "Powered by Atmosphere Comments for Astro" link to the [announcement post](https://saltedlolly.com/atmosphere-comments-for-astro/) (a permanent address on saltedlolly.com that forwards to the post). It's **on by default and optional**: `credit={false}` hides it. Keep it that way: the licence is plain MIT, and the credit must never become a condition of use.
- The README's **Saying thanks** section asks, politely, for the credit link or a link to saltedlolly.com, and mentions GitHub Sponsors and Ko-fi. Keep that tone: a request, not a requirement.
- If the credit's address or wording changes, update the component, the README's component table and Saying thanks, and the CHANGELOG.

## Styling

- Colours come from CSS custom properties set on `.atmo` (`--atmo-text`, `--atmo-muted`, `--atmo-accent`, `--atmo-on-accent`, `--atmo-border`, `--atmo-field-bg`, `--atmo-card-bg`, `--atmo-menu-bg`, `--atmo-ring`, `--atmo-danger`, `--atmo-radius`), each with a sensible default. Add new colours the same way, and list them in the README.
- Elements the script creates (comments and their buttons) don't carry Astro's scoping attribute, so their styles are `:global(...)`. Defaults for the comment classes a site is likely to restyle are wrapped in `:where(...)`, so they carry no weight and a site's own rules always win.
- The logo is single-colour and drawn with a CSS mask in `currentColor` or a token, so it follows the theme.
- Wording is plain English (British spelling), short, and English only for now.

## Trying a change

- In a site that uses the package, run the dev server on `127.0.0.1` (`npx astro dev --host 127.0.0.1`) and open it there, not at `localhost`: locally the package uses the protocol's development client, which needs that address.
- Before a release, `npm pack` and install the file into a fresh Astro site (`npm install ../astro-atmosphere-comments-x.y.z.tgz`), then try both `astro dev` and a production build with the Node adapter. There is no automated test suite yet.
- Never commit keys, `.env` files or the data folder (`.data/`).

## Releasing

1. Bump `version` in `package.json` and add a dated section to `CHANGELOG.md` (say what changed for sites, and anything they need to do).
2. Commit, tag `vX.Y.Z`, and push the commit and the tag.
3. The maintainer publishes to npm (`npm publish`).
4. Add a short, reader-friendly entry to the **Release notes** at the end of the [announcement post](https://saltedlolly.com/atmosphere-comments-for-astro/) on saltedlolly.com, and update the post if anything it describes has changed.

Until 1.0, a release that changes how a site uses the package (an option's meaning, the markup sites style) bumps the middle number.
