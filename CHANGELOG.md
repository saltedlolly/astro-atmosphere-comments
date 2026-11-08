# Changelog

## 0.7.0 (8 November 2026)

**Comments from people who show their posts only to signed-in readers.** Those accounts use Bluesky's "Discourage apps from showing my account to logged-out users".

- **Signed-in readers see them:** the reader's browser fetches those comments through the reader's own sign-in (`app.bsky.feed.getPosts`, already part of the approval, so nobody has to sign in again). They then show as normal comments, with Reply, Like and Repost. Signing out puts the placeholders back. The server still never sends their names, pictures or words; the page holds only each comment's address (its AT URI).
- **Signed-out readers get a clearer placeholder:** a blurred stand-in made of grey bars (never the real comment), with "Comment hidden" and a line saying to sign in to see it. Clicking it opens the sign-in overlay, and the page scrolls to the comment once they're back. The replies under it stay, as before. Styles: `.atmo-comment--withheld`, `.atmo-withheld__ghost`, `.atmo-withheld__cover`; `.atmo-comment__withheld` is gone.
- **Like and repost counts match the faces:** those accounts are no longer left out of the faces. Signed out, they show as a faceless silhouette (`.atmo-avatar-anonymous`) with no name or link; signed in, their real face, looked up through the site's `profile` route. The thread data gives only their DID (`withheld: true`).
- A broken avatar picture now falls back to the person's initial.
- New wording keys `comment.withheldTitle`, `comment.withheldSignedIn`, `signInFirst.view`, `reactions.hiddenPerson`; `comment.withheld` changed. Draft translations in all eight languages.

## 0.6.1 (7 November 2026)

- Uses the current AT Protocol library (`@atproto/api` 0.30, was 0.25), the same version as Atmosphere Publishing for Astro, so a site using both installs it once.
- README: using it with [Atmosphere Publishing for Astro](https://github.com/saltedlolly/astro-atmosphere-publishing), and with other Standard.site publishers such as Sequoia.

## 0.6.0 (7 November 2026)

**Buttons for everyone, and Standard.site support for readers.** The buttons and sign-in change applies to every site; Subscribe and recommending are optional.

- **Signed-out readers see the same buttons:** Like, Repost, Quote and a "Write a comment…" box show under every post. Pressing one opens a sign-in overlay that says what it's for, and what they pressed is finished once they're back. The sign-in form and "Reply on Bluesky instead" moved into that overlay, with the detail on how signing in works behind a "How does signing in work?" toggle. New keys `signIn.more`, `comment.signIn`. In `AtmosphereReactions`, Reply and Quote now open it too, rather than going to Bluesky (⌘-click still does). Sites that style `.atmo__signed-out` should check their rules: it's gone. `signIn.heading` and `signInFirst.…` wording changed, and the `label` prop now sets the overlay's heading when commenting.

- **`standardSite` option:** `{ publication: "at://did:…/site.standard.publication/…" }`. The package still doesn't publish Standard.site records; it works with any tool that does.
- **Subscribe:** a button under each post, with Like and Repost (`.atmo-subscribe`), writes a `site.standard.graph.subscription` record to the reader's own account. Anyone not signed in gets the sign-in form and is subscribed once they're back. Only your publication can be subscribed to. Anywhere else, with `AtmosphereReactions` in your layout, a `<button data-atmosphere-subscribe hidden>` becomes Subscribe / ✓ Subscribed.
- **Menu beside Subscribe:** a line on what subscribing does, Copy link, RSS feed (with the option's `feed`), View on Bluesky and View on Standard Reader.
- **Like also recommends:** with the option set, Like on a post whose page has `<link rel="site.standard.document">` also writes a `site.standard.graph.recommend` record, and un-liking removes it. Likes on comments and on the posts `AtmosphereReactions` shows stay Bluesky likes. Recommend counts aren't shown yet.
- **Signing in shows it's started:** the Sign in button is disabled with a spinner from the moment a reader presses it, presses Enter or picks a suggested account, until the browser leaves for their account host. New class `.atmo__spinner`.
- **Quote preview closer to Bluesky:** it shows the quoted post's age and the card's divider with the domain, and leaves out empty text.
- **One approval:** whichever button a reader presses, signing in asks for everything at once. Standard.site's permission (`include:site.standard.authSocial`) is part of the first sign-in, with no second trip to the account host.

### Upgrading from 0.5

- **If you set `standardSite`, readers already signed in are signed out once** and sign in again, so everything is approved together. Without the option, sign-ins carry on as they were.
- New wording keys (`subscribe.…`, `signInFirst.likePost`, `signInFirst.repostPost`, `signInFirst.quotePost`, `comment.prompt`), in English until they're translated.

## 0.5.0 (4 November 2026)

**Readers' sign-ins now stay in their own browsers.** This changes how the package works, so read "Upgrading" below.

- **Browser sign-in:** readers sign in as a browser ("public") OAuth client, with `@atproto/oauth-client-browser`. Their sign-in is kept in their browser's storage, with a key the browser won't let even the page's code read out, and comments, likes, reposts, deletes and follows go from their browser straight to their own account host. Your server never sees a sign-in, sets no cookies and stores nothing, so it has no way to post for anyone. Signing out cancels the sign-in at the reader's host and deletes it from their browser. Account hosts give browser sign-ins a shorter life (Bluesky's last about two weeks).
- **One approval for everything:** signing in asks for all that readers can do here at once (posting; liking and reposting; deleting their comments; following your accounts), plus hiding comments when the account is one of your own (`allowedAuthors`). Deleting and following were asked for separately before; with the sign-in in the browser, separate trips to the account host only confused readers. Permissions are grouped in `lib/permissions.ts`. Readers whose sign-in lacks a group (one from before it was added) are asked for it when it's first needed, after the page says what it's for, which account, and that their account host may ask them to sign in again first. `SignInForm` takes a `permissions` prop for anything more.
- **Hide comments:** signed in as the account that posted the announcement, a Hide button under other people's comments hides them here and on Bluesky (the announcement's threadgate, as the Bluesky app does). The first hide asks for that permission. Show them again in the Bluesky app. Fires `atmosphere:hidden` (`detail`: `uri`).
- **Respecting "logged-out" privacy:** accounts that use Bluesky's "Discourage apps from showing my account to logged-out users" are no longer shown on the page, which is public. Their comments become a short "Not shown here" placeholder (nothing about them reaches the page) with the replies under them kept, and they're left out of the like and repost faces. New wording key `comment.withheld`; style `.atmo-comment__withheld`.
- **Fewer third parties:** account lookups while signing in go through your server (`/atmosphere/identity`), so readers' browsers contact only their own account host.
- Under the sign-in button, a line says the sign-in stays in the browser, with a link to your privacy policy if you set `policyUri`.
- Routes: `login`, `logout`, `me`, `comment`, `react`, `delete`, `follow`, `state` and `jwks.json` are gone. New: `identity`, `profile`, `richtext` (links and mentions in a comment, before it's posted) and `following`; `callback` is now a page; `POST /atmosphere/thread` refreshes a thread after a reader posts. The `typeahead` limits are per address for everyone.
- The `keygen` command is gone: there's no key.
- New wording keys (`signIn.access`, `signIn.policy`, `composer.needsPermission`, `comment.hide…`, `comment.deleteElsewhere`, `permission.…`, `callback.signingIn`) in all eight languages; `messages.newPermissions` is gone and `messages.needsPermission` is now general.

### Upgrading from 0.4

- Remove `ATMOSPHERE_PRIVATE_JWK` and `ATMOSPHERE_DATA_DIR` from your server's environment (and your deploy's secrets), and delete the data folder (default `.data/atmosphere`). The sign-ins in it can't be used without it: their tokens only work with keys kept in those files.
- **Readers will need to sign in again.** Their old sign-ins (made with the server key) may still be listed at their account host until they expire; they can remove them there.
- If you set a Content Security Policy, allow `connect-src` to readers' account hosts (any `https:` address), since the browser now talks to them directly.
- The site no longer needs a disk that persists.

## 0.4.2 (4 November 2026)

- Links open in a new tab: those in the sign-in form, "Reply on Bluesky instead", the credit, and the thread's names, dates, faces and links in comments, so readers don't lose their place (and a half-written comment).

## 0.4.1 (4 November 2026)

- Fixed: the sign-in and reply overlays of `AtmosphereReactions` showed at the bottom of the page instead of staying hidden until opened (the shared stylesheet made every `.atmo` element a block, dialogs included).

## 0.4.0 (4 November 2026)

- **`AtmosphereReactions`:** likes and reposts on your other Bluesky posts (a feed of your latest posts, say). Mark each post with `data-atmosphere-post` (and its bsky.app address and counts) and put the component once in your layout: each post gets Reply and Quote (opening it on Bluesky), and Repost and Like with counts. Readers who aren't signed in get the sign-in form in an overlay, and their like or repost is done once they're back. Only posts by `allowedAuthors` can be liked or reposted.
- **Which account you're using:** `AtmosphereReactions` fills any element marked `data-atmosphere-account` with the signed-in reader's avatar, opening a menu with "Signed in as @handle" and Sign out.
- **Reply and Quote in an overlay:** for signed-in readers, Reply and Quote under those posts open the comment box (with the quote preview) in an overlay; once posted it says it's on Bluesky, not on this page, with a link. Signed out (or with ⌘-click), they open the post on Bluesky.
- **Follow:** a link marked `data-atmosphere-follow` (an account's DID) becomes a Follow / Following button for signed-in readers (a second press unfollows, as on Bluesky, without inviting it: no "Unfollow" on hover). Permission to follow is asked for only on the first follow, and only `allowedAuthors` can be followed. Asking for a new permission keeps the ones a reader already gave.
- "Post reply" in reply boxes under comments is now translated (it was always English).
- The Like and Repost buttons say whose account they use ("Like as @handle") when the reader is signed in.
- The sign-in form (`SignInForm.astro`) and the comment box (`Composer.astro`, with `lib/client/composer.ts`) are now components of their own, shared by the comments and the overlays, and the comment box's styles are a shared stylesheet (`atmosphere.css`, global, every class starting `atmo`). Nothing changes for sites, unless they relied on those styles being scoped.
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
