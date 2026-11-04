# Atmosphere Comments for Astro

Bluesky comments for your Astro site, without the reader leaving the page. (On npm: [`astro-atmosphere-comments`](https://www.npmjs.com/package/astro-atmosphere-comments).)

Under each post, readers type their Bluesky handle (or that of any other [Atmosphere account](https://atmosphereaccount.com)) into the **Sign in with Atmosphere** form, which suggests matching accounts with their avatars as they type, and can then:

- **comment** on your post, and **reply** to other comments;
- **like** and **repost** your post, or any comment under it;
- **quote** your post on their own profile, with a Bluesky-style preview;
- **@mention** people, with suggestions as they type;
- **delete** their own comments.

Everything they post is written to **their own account**, as ordinary Bluesky posts, likes and reposts: comments are replies to your post's announcement on Bluesky. They can delete them in any Bluesky app, and people who prefer the app can reply there instead; it all shows up on your page the same way.

The component also **shows the thread**: who liked and reposted your post, and the comments, nested, with their own Reply, Like and Repost.

See it on [saltedlolly.com](https://saltedlolly.com/2005/07/13/summer-jam-party-at-miyun-reservoir/), where it was built.

## How it works

1. You announce each post on Bluesky (a post linking to it). That post's thread is the comment section.
2. A reader signs in with **AT Protocol OAuth, straight to their own account host** (Bluesky's, for most people), which asks them to approve your site, named by its address (example.com). There is no third-party login service in between, and your site never sees a password.
3. Your site asks only for what commenting needs: to create posts, to create and delete likes and reposts, and to see which posts the reader has already liked or reposted. Permission to delete posts is asked for separately, only the first time a reader deletes one of their comments on your site, and the site only ever uses it on their own comments under your posts. Readers can revoke it all at any time in their Bluesky settings.
4. Your server keeps each reader's sign-in (a random cookie in their browser; their tokens on your server), and posts on their behalf when they press a button.

Readers who'd rather not sign in can use the **Reply on Bluesky instead** link under the form.

Images (avatars, link-card pictures) and account searches (the suggestions under the sign-in box and for @mentions) go through your server, so readers' browsers never contact Bluesky directly.

## Requirements

- **Astro 7** with an on-demand (server) adapter, such as [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/). The pages themselves can stay static; the integration adds a few server routes.
- **Node 20.19 or later**, with a **disk that persists** between deploys and restarts: sign-ins are stored as files. (Serverless hosts without a lasting disk aren't supported yet.)
- A **Bluesky account that announces your posts**. Each post needs its announcement's address, or a [Standard.site](https://standard.site) record that points to it (see below).
- Your site's **`site`** set in `astro.config`.

## Install

```sh
npm install astro-atmosphere-comments
```

### 1. Add the integration

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import atmosphereComments from "astro-atmosphere-comments";

export default defineConfig({
  site: "https://example.com",
  adapter: node({ mode: "standalone" }),
  integrations: [
    atmosphereComments({
      clientName: "example.com",
      // The DIDs of the account(s) that post your announcements, and your own.
      allowedAuthors: ["did:plc:your-did-here"],
      logoUri: "https://example.com/logo.png",
    }),
  ],
});
```

To find an account's DID: `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=you.bsky.social`.

### 2. Create your site's signing key

```sh
npx astro-atmosphere-comments keygen
```

This adds `ATMOSPHERE_PRIVATE_JWK` to your `.env` without printing it. Your site signs its requests to readers' account hosts with it; the public half is published at `/atmosphere/jwks.json`, and the site's details for account hosts (its name, logo and permissions) at `/oauth-client-metadata.json`. That second file has to be at your site's root: it's the conventional address, and only then does Bluesky's approval page name your site by its address alone. Set the same variable on your server, keep `.env` out of Git, and keep a backup: **a new key signs every reader out.**

On the server, also set `ATMOSPHERE_DATA_DIR` to a folder **outside your deploy folder** (for example `/var/lib/example-com/atmosphere`), so deploys don't sign readers out. It defaults to `.data/atmosphere` in the project.

### 3. Put the component under your posts

```astro
---
import AtmosphereComments from "astro-atmosphere-comments/AtmosphereComments.astro";
---

<AtmosphereComments post="https://bsky.app/profile/you.bsky.social/post/3abc…" />
```

`post` can be the announcement's **bsky.app address** or its **AT URI**. Leave it out and the component uses the page's **Standard.site** record instead: if your page has `<link rel="site.standard.document" href="at://…">` and that record's `bskyPostRef` points to the announcement (as Standard.site publishers do), it just works. With no announcement to respond to, the component shows nothing (apart from your slot content).

### 4. Optional: likes and reposts on your other Bluesky posts

If your pages show your Bluesky posts elsewhere (a "latest posts" feed on your homepage, say), readers can like and repost them there too. Put `AtmosphereReactions` once in your layout, and mark each post's element:

```astro
---
import AtmosphereReactions from "astro-atmosphere-comments/AtmosphereReactions.astro";
---

<article
  data-atmosphere-post="at://did:plc:…/app.bsky.feed.post/…"
  data-atmosphere-url="https://bsky.app/profile/you.bsky.social/post/…"
  data-atmosphere-likes="3"
  data-atmosphere-reposts="1"
>
  …the post…
</article>

<AtmosphereReactions />
```

Each marked post gets a row of icons: Reply and Quote (which open the post on Bluesky), and Repost and Like with their counts. Readers already signed in on your site like and repost straight away. Anyone else is offered the sign-in form in an overlay, and their like or repost is done when they come back. It works with posts from loaders such as [`@ascorbic/bluesky-loader`](https://www.npmjs.com/package/@ascorbic/bluesky-loader) or embeds such as [`@astro-community/astro-embed-bluesky`](https://www.npmjs.com/package/@astro-community/astro-embed-bluesky) (wrap the embed in the marked element). Only posts by your `allowedAuthors` can be liked or reposted through your site.

### Trying it on your own computer

Run the dev server on `127.0.0.1` and open the site there, not at `localhost`:

```sh
npx astro dev --host 127.0.0.1
```

Locally the integration uses the protocol's development mode, so no key is needed and it works without a public address. Bluesky's approval screen will say a development app is asking; that's expected.

## Options

| Option | Required | What it does |
| --- | --- | --- |
| `clientName` | yes | Your site's name, given to readers' account hosts. (Bluesky's approval page shows your site's address instead, unless Bluesky has marked your site as trusted.) |
| `allowedAuthors` | yes | DIDs of the accounts whose posts can be commented on through your site. Comments from these accounts get the Author badge. |
| `logoUri` | | A square logo for the sign-in screen (absolute `https://` address). |
| `policyUri`, `tosUri` | | Your privacy policy and terms, shown on the sign-in screen. |
| `hidden` | | Comments never to show: bsky.app post or profile addresses, AT URIs, handles or DIDs. Replies you hide in the Bluesky app, and posts with Bluesky's moderation labels (spam and so on), are left out anyway. |
| `base` | | Where the integration's routes live. Default `/atmosphere`. |
| `locale` | | The language of the wording, such as `"fr"` or `"pt-BR"` (see Languages). |
| `messages` | | Your own wording for any line, by its key in [`locales/en.json`](locales/en.json). |

## The component

| Prop | What it does |
| --- | --- |
| `post` | The announcement: bsky.app address or AT URI. Optional with Standard.site (above). |
| `label` | The sign-in form's heading. Default "Sign in to leave a comment, like or repost". |
| `authorLabel` | The badge on your own comments. Default "Author". |
| `blueskyLink` | "Rather not sign in here? Reply on Bluesky instead →" under the sign-in form, linking to the announcement (with `u-syndication`, so microformats readers learn it's the post's copy on Bluesky). Default `true`; `blueskyLink={false}` hides it. |
| `locale`, `messages` | The same as the integration's options, for this one component. |
| `locale`, `messages` (also on `AtmosphereReactions`) | See Languages. |
| `credit` | A small "Powered by Atmosphere Comments for Astro" link at the end. Default `true`; set `credit={false}` to hide it. |

**Slots:** `after-box` goes between the comment box and the comments (a note about other ways to respond, say); the default slot goes after the comments (other responses, older comments).

**Layout, top to bottom:** likes and reposts, the sign-in form and the "Reply on Bluesky instead" line (or, signed in, Like, Repost, Quote and the comment box), your `after-box` content, the comments, your default slot content.

## Languages

The wording comes in English, French, German, Spanish, Portuguese, Italian, Dutch and Japanese. The component uses, in order: its `locale` prop, the integration's `locale` option, Astro's own locale for the page (if you use [Astro's i18n routing](https://docs.astro.build/en/guides/internationalization/)), then English. A regional code falls back to its language (`pt-BR` uses `pt`), and any line a language lacks is shown in English. Dates follow the same language.

To change any line, give its key from [`locales/en.json`](locales/en.json):

```js
atmosphereComments({
  // …
  locale: "fr",
  messages: { "signIn.heading": "Connecte-toi pour rejoindre la conversation" },
}),
```

The translations other than English started as drafts and need checking by native speakers. Translation is being set up on [Weblate](https://weblate.org), the open-source translation platform; until then, corrections and new languages are very welcome as [GitHub issues or pull requests](https://github.com/saltedlolly/astro-atmosphere-comments/issues). (Bluesky's own approval page is in the reader's language already.)

## Styling

It has a plain default look and takes your text colour. Colours come from CSS custom properties, set on `.atmo`:

```css
.atmo {
  --atmo-text: #222;
  --atmo-muted: #666;
  --atmo-accent: #c2185b;     /* buttons, links, pressed Like */
  --atmo-on-accent: #fff;     /* text on accent buttons */
  --atmo-border: #ddd;
  --atmo-field-bg: #f6f6f6;   /* text boxes */
  --atmo-card-bg: #fafafa;    /* comments */
  --atmo-menu-bg: #fff;       /* account and @mention suggestions */
  --atmo-ring: #fff;          /* the outline round faces */
  --atmo-danger: #c0392b;     /* Delete, when confirming */
  --atmo-dialog-bg: #fff;     /* the sign-in overlay (defaults to --atmo-menu-bg) */
  --atmo-radius: 10px;
}
```

The likes and comments are drawn with classes you can style directly (`.atmo-reactions`, `.atmo-facepile`, `.atmo-comments`, `.atmo-comment`, `.atmo-comment--nested`, `.atmo-comment--author`, `.atmo-comment__header`, `__avatar`, `__author`, `__badge`, `__date`, `__body`, and `.atmo-comment-actions` for Reply, Like and Repost, and `.atmo-post-actions` / `.atmo-post-action` for the row `AtmosphereReactions` adds). Their defaults carry no CSS weight, so your rules always win.

## Events

The component fires (bubbling):

- `atmosphere:commented` after a comment, reply or quote is posted (`detail`: `uri`, `url`, `text`, `author`, `createdAt`, `quote`, `parent`);
- `atmosphere:reacted` after a like or repost of the post, or undoing one (`detail`: `kind`, `on`, `author`).
- `atmosphere:deleted` after a reader deletes one of their comments (`detail`: `uri`).

## Security and privacy

- **What your server stores:** for each signed-in reader, their DID and their OAuth tokens (which can only post, like and repost as described above, and delete posts if the reader allowed it), plus a random cookie value. Files are readable only by your site's user. Mention this in your privacy policy.
- **What it refuses:** requests that change something must come from your own pages (checked by `Origin`); only your announcements and comments in their threads can be acted on; only a reader's own replies under your announcements can be deleted; comments, likes and searches are rate-limited per account, and searches by readers who aren't signed in per address and overall; the image route only passes on avatars and link pictures it has just shown.
- **Moderation:** comments appear automatically. Hide one in the Bluesky app (it disappears here too), block the account, or add it to `hidden`.
- Comments are plain text, as on Bluesky: links, @mentions and #hashtags become links.

## Limitations (for now)

- Needs a Node server with a lasting disk (no serverless or edge hosts yet).
- Rate limits are kept in memory, so they apply per server process.
- Quoting individual comments isn't supported.

If you only want readers to sign in with their Atmosphere account, without comments, see [AuthProto](https://www.npmjs.com/package/@fujocoded/authproto).

## Saying thanks

It's free to use (MIT), with no strings attached. If it's useful to you, I'd be grateful if you kept the small credit link, or linked to [saltedlolly.com](https://saltedlolly.com) somewhere on your site. You can also [sponsor me on GitHub](https://github.com/sponsors/saltedlolly) or [buy me a coffee on Ko-fi](https://ko-fi.com/saltedlolly).

## Credits

Made by [Olly Stedall](https://saltedlolly.com) for [saltedlolly.com](https://saltedlolly.com). The Atmosphere Account logo is from [Atmosphere Account](https://github.com/jobiwanken0bi/atmosphere-account) (MIT, © 2026 Joseph Basser).

## License

MIT
