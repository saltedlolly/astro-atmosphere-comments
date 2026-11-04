# Changelog

## 0.4.0 (4 November 2026)

- **`AtmosphereReactions`:** likes and reposts on your other Bluesky posts (a feed of your latest posts, say). Mark each post with `data-atmosphere-post` (and its bsky.app address and counts) and put the component once in your layout: each post gets Reply and Quote (opening it on Bluesky), and Repost and Like with counts. Readers who aren't signed in get the sign-in form in an overlay, and their like or repost is done once they're back. Only posts by `allowedAuthors` can be liked or reposted.
- The sign-in form is now its own component (`SignInForm.astro`), shared by the comments and the overlay; nothing changes for sites.
- New wording keys for the overlay and the post actions, in all eight languages.

## 0.3.0 (4 November 2026)

- **Languages:** the wording now comes from language files (`locales/*.json`, i18next JSON) in English, French, German, Spanish, Portuguese, Italian, Dutch and Japanese, picked from the component's `locale` prop, the integration's `locale` option or Astro's locale for the page, then English. Dates and plurals ("1 like", "2 likes") follow the language. The translations are drafts for native speakers to check; translation is being set up on Weblate.
- **Your own wording:** a `messages` option (and prop) changes any line, by its key in `locales/en.json`.
- The `label` and `authorLabel` props still work, and win over `messages`.

## 0.2.0 (4 November 2026)

- The sign-in form is shown straight away under each post: a handle box and a **Sign in with Atmosphere** button, both with the Atmosphere logo. The "Respond with your Atmosphere Account" button that opened it is gone.
- `label` is now the form's heading (default "Sign in to leave a comment, like or repost"). If you set it for the old button's small text, change or remove it.
- As readers type in the handle box, **matching accounts are suggested** with their avatar, name and handle, so they can see they've found the right one; picking one signs in with it. Enter still signs in with exactly what was typed.
- Under the sign-in form, **"Rather not sign in here? Reply on Bluesky instead →"** links to the announcement, for readers who'd rather reply in the Bluesky app (`blueskyLink={false}` hides it). If your page already says this in the `after-box` slot, remove one.
- Readers can **delete their own comments**: a Delete button under each of them, with a confirmation. Signing in no longer asks for permission to delete posts; the first delete asks the reader's account host for it (one more approval), then finishes. The server only ever deletes the reader's own replies under your announcements. Fires `atmosphere:deleted` (`detail`: `uri`).
- The site's OAuth client metadata moved to `/oauth-client-metadata.json` at the site's root (was `/atmosphere/client-metadata.json`), so Bluesky's approval page names the site by its address ("saltedlolly.com") instead of showing a file address. **Readers already signed in will need to sign in once more**, because their sign-in belonged to the old address. If your site already serves a file at that address, the two will clash.
- The handle box keeps `name="handle"` (the name most atproto apps use, so browsers can suggest handles typed elsewhere) and asks password managers to leave it alone: it isn't a login for your site, so they offered the wrong one. This follows the community's emerging convention and may change (see AGENTS.md).
- `--atmo-danger` sets the colour of the confirming Delete button.
- Pressing Reply, Like or Repost on a comment while signed out moves to the form and puts the cursor in the handle box.

## 0.1.1 (3 November 2026)

- The credit link now goes to a permanent address, saltedlolly.com/atmosphere-comments-for-astro/.

## 0.1.0 (3 November 2026)

First release, as used on [saltedlolly.com](https://saltedlolly.com).

- "Respond with your Atmosphere Account": readers sign in with Bluesky or any Atmosphere account (AT Protocol OAuth straight to their own host, no third-party login service).
- Comment, reply to a comment, like, repost and quote post, all written to the reader's own account; @mention suggestions; a Bluesky-style quote preview.
- Shows the thread: likes and reposts with faces, and nested comments with their own Reply, Like and Repost.
- Finds the post's Bluesky announcement from an AT URI, a bsky.app address, or the page's Standard.site record.
- `npx astro-atmosphere-comments keygen` creates the site's signing key.
- A small "Powered by Atmosphere Comments for Astro" credit link, which `credit={false}` hides.
