# astro-atmosphere-comments

Bluesky comments for your Astro site, without the reader leaving the page.

Readers press **Respond with your Atmosphere Account**, sign in with their Bluesky handle (or any other [Atmosphere account](https://atmosphereaccount.com)), and can then:

- **comment** on your post, and **reply** to other comments;
- **like** and **repost** your post, or any comment under it;
- **quote** your post on their own profile, with a Bluesky-style preview;
- **@mention** people, with suggestions as they type.

Everything they post is written to **their own account**, as ordinary Bluesky posts, likes and reposts: comments are replies to your post's announcement on Bluesky. They can delete them in any Bluesky app, and people who prefer the app can reply there instead; it all shows up on your page the same way.

The component also **shows the thread**: who liked and reposted your post, and the comments, nested, with their own Reply, Like and Repost.

See it on [saltedlolly.com](https://saltedlolly.com/2005/07/13/summer-jam-party-at-miyun-reservoir/), where it was built.

## How it works

1. You announce each post on Bluesky (a post linking to it). That post's thread is the comment section.
2. A reader signs in with **AT Protocol OAuth, straight to their own account host** (Bluesky's, for most people). There is no third-party login service in between, and your site never sees a password.
3. Your site asks only for what commenting needs: to create and delete posts, likes and reposts, and to see which posts the reader has already liked or reposted. Readers can revoke it at any time in their Bluesky settings.
4. Your server keeps each reader's sign-in (a random cookie in their browser; their tokens on your server), and posts on their behalf when they press a button.

Images (avatars, link-card pictures) and @mention searches go through your server, so readers' browsers never contact Bluesky directly.

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

This adds `ATMOSPHERE_PRIVATE_JWK` to your `.env` without printing it. Your site signs its requests to readers' account hosts with it; the public half is published at `/atmosphere/jwks.json`. Set the same variable on your server, keep `.env` out of Git, and keep a backup: **a new key signs every reader out.**

On the server, also set `ATMOSPHERE_DATA_DIR` to a folder **outside your deploy folder** (for example `/var/lib/example-com/atmosphere`), so deploys don't sign readers out. It defaults to `.data/atmosphere` in the project.

### 3. Put the component under your posts

```astro
---
import AtmosphereComments from "astro-atmosphere-comments/AtmosphereComments.astro";
---

<AtmosphereComments post="https://bsky.app/profile/you.bsky.social/post/3abc…" />
```

`post` can be the announcement's **bsky.app address** or its **AT URI**. Leave it out and the component uses the page's **Standard.site** record instead: if your page has `<link rel="site.standard.document" href="at://…">` and that record's `bskyPostRef` points to the announcement (as Standard.site publishers do), it just works. With no announcement to respond to, the component shows nothing (apart from your slot content).

### Trying it on your own computer

Run the dev server on `127.0.0.1` and open the site there, not at `localhost`:

```sh
npx astro dev --host 127.0.0.1
```

Locally the integration uses the protocol's development mode, so no key is needed and it works without a public address. Bluesky's approval screen will say a development app is asking; that's expected.

## Options

| Option | Required | What it does |
| --- | --- | --- |
| `clientName` | yes | Your site's name on the reader's sign-in screen. |
| `allowedAuthors` | yes | DIDs of the accounts whose posts can be commented on through your site. Comments from these accounts get the Author badge. |
| `logoUri` | | A square logo for the sign-in screen (absolute `https://` address). |
| `policyUri`, `tosUri` | | Your privacy policy and terms, shown on the sign-in screen. |
| `hidden` | | Comments never to show: bsky.app post or profile addresses, AT URIs, handles or DIDs. Replies you hide in the Bluesky app, and posts with Bluesky's moderation labels (spam and so on), are left out anyway. |
| `base` | | Where the integration's routes live. Default `/atmosphere`. |

## The component

| Prop | What it does |
| --- | --- |
| `post` | The announcement: bsky.app address or AT URI. Optional with Standard.site (above). |
| `label` | The small words on the button above "Atmosphere Account". Default "Respond with your". |
| `authorLabel` | The badge on your own comments. Default "Author". |

**Slots:** `after-box` goes between the comment box and the comments (a note about other ways to respond, say); the default slot goes after the comments (other responses, older comments).

**Layout, top to bottom:** likes and reposts, the button (or, signed in, Like, Repost, Quote and the comment box), your `after-box` content, the comments, your default slot content.

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
  --atmo-menu-bg: #fff;       /* @mention suggestions */
  --atmo-ring: #fff;          /* the outline round faces */
  --atmo-radius: 10px;
}
```

The likes and comments are drawn with classes you can style directly (`.atmo-reactions`, `.atmo-facepile`, `.atmo-comments`, `.atmo-comment`, `.atmo-comment--nested`, `.atmo-comment--author`, `.atmo-comment__header`, `__avatar`, `__author`, `__badge`, `__date`, `__body`, and `.atmo-comment-actions` for Reply, Like and Repost). Their defaults carry no CSS weight, so your rules always win.

## Events

The component fires (bubbling):

- `atmosphere:commented` after a comment, reply or quote is posted (`detail`: `uri`, `url`, `text`, `author`, `createdAt`, `quote`, `parent`);
- `atmosphere:reacted` after a like or repost of the post, or undoing one (`detail`: `kind`, `on`, `author`).

## Security and privacy

- **What your server stores:** for each signed-in reader, their DID and their OAuth tokens (which can only post, like and repost as described above), plus a random cookie value. Files are readable only by your site's user. Mention this in your privacy policy.
- **What it refuses:** requests that change something must come from your own pages (checked by `Origin`); only your announcements and comments in their threads can be acted on; comments, likes and searches are rate-limited per account; the image route only passes on avatars and link pictures it has just shown.
- **Moderation:** comments appear automatically. Hide one in the Bluesky app (it disappears here too), block the account, or add it to `hidden`.
- Comments are plain text, as on Bluesky: links, @mentions and #hashtags become links.

## Limitations (for now)

- Needs a Node server with a lasting disk (no serverless or edge hosts yet).
- Rate limits are kept in memory, so they apply per server process.
- The wording is English only.
- Quoting individual comments isn't supported.

If you only want readers to sign in with their Atmosphere account, without comments, see [AuthProto](https://www.npmjs.com/package/@fujocoded/authproto).

## Credits

Made by [Olly Stedall](https://saltedlolly.com) for [saltedlolly.com](https://saltedlolly.com). The Atmosphere Account logo is from [Atmosphere Account](https://github.com/jobiwanken0bi/atmosphere-account) (MIT, © 2026 Joseph Basser).

## License

MIT
