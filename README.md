# Atmosphere Comments for Astro

Bluesky comments for your Astro site, without the reader leaving the page. (On npm: [`astro-atmosphere-comments`](https://www.npmjs.com/package/astro-atmosphere-comments).)

Under each post, readers type their Bluesky handle (or that of any other [Atmosphere account](https://atmosphereaccount.com)) into the **Sign in with Atmosphere** form, which suggests matching accounts with their avatars as they type, and can then:

- **comment** on your post, and **reply** to other comments;
- **like** and **repost** your post, or any comment under it;
- **quote** your post on their own profile, with a Bluesky-style preview;
- **@mention** people, with suggestions as they type;
- **delete** their own comments.

And signed in as one of your own accounts, you can **hide** comments under your posts, here and on Bluesky.

Everything they post is written to **their own account**, as ordinary Bluesky posts, likes and reposts: comments are replies to your post's announcement on Bluesky. They can delete them in any Bluesky app, and people who prefer the app can reply there instead; it all shows up on your page the same way.

The component also **shows the thread**: who liked and reposted your post, and the comments, nested, with their own Reply, Like and Repost.

See it on [saltedlolly.com](https://saltedlolly.com/2005/07/13/summer-jam-party-at-miyun-reservoir/), where it was built.

## How it works

1. You announce each post on Bluesky (a post linking to it). That post's thread is the comment section.
2. A reader signs in with **AT Protocol OAuth, straight to their own account host** (Bluesky's, for most people), which asks them to approve your site, named by its address (example.com). There is no third-party login service in between, and your site never sees a password.
3. **The sign-in stays in the reader's browser.** Your server never sees it: comments, likes and reposts go from the reader's browser straight to their own account host. So your server has no way to post for anyone, a copy of your server's files holds nothing about your readers, and when a reader signs out, the sign-in is cancelled at their host and deleted from their browser. That's it: nothing is left anywhere.
4. Your site asks, in one approval, only for what readers can do on it: to create posts, to like and repost, to delete their comments and to follow your accounts (and, when one of your own accounts signs in, to hide comments; with the `standardSite` option, to subscribe and recommend). Each is used only on your posts, the comments under them and your accounts. Readers can see and cancel it all at their account host.

Everyone sees Like, Repost, Quote and a box to write a comment. Pressing any of them signed out opens an overlay to sign in, and what they pressed is finished once they're back. Readers who'd rather not sign in can use the **Respond on Bluesky** link in the overlay.

Images (avatars, link-card pictures), account searches (the suggestions under the sign-in box and for @mentions) and account lookups when signing in go through your server, so readers' browsers contact only their own account host, never Bluesky's other servers.

## Requirements

- **Astro 7** with an on-demand (server) adapter, such as [`@astrojs/node`](https://docs.astro.build/en/guides/integrations-guide/node/). The pages themselves can stay static; the integration adds a few server routes.
- **Node 20.19 or later.** Nothing is stored on your server (no sign-ins, no cookies, no files), so no disk or database is needed.
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

The integration also publishes your site's details for account hosts (its name, logo and permissions) at `/oauth-client-metadata.json`. That file has to be at your site's root: it's the conventional address, and only then does Bluesky's approval page name your site by its address alone. There's no key or secret to set up.

### 2. Put the component under your posts

```astro
---
import AtmosphereComments from "astro-atmosphere-comments/AtmosphereComments.astro";
---

<AtmosphereComments post="https://bsky.app/profile/you.bsky.social/post/3abc…" />
```

`post` can be the announcement's **bsky.app address** or its **AT URI**. Leave it out and the component uses the page's **Standard.site** record instead: if your page has `<link rel="site.standard.document" href="at://…">` and that record's `bskyPostRef` points to the announcement (as Standard.site publishers do), it just works. With no announcement to respond to, the component shows nothing (apart from your slot content).

### 3. Optional: likes and reposts on your other Bluesky posts

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

Give `data-atmosphere-url` with the author's handle, as above. An address with a DID instead (`/profile/did:plc:…/post/…`) works too: the reply box then shows "Replying to someone" until the post has loaded through your site, then the handle, and never the DID.

Each marked post gets a row of icons: Reply, Repost, Quote and Like, with counts for Repost and Like. Readers already signed in on your site like and repost straight away, and Reply and Quote open the comment box in an overlay (Reply with the post being replied to above the box, Quote with the quote preview); what they post goes to Bluesky, not your page, and the overlay says so with a link to it. Anyone else is offered the sign-in form in an overlay when they press Like or Repost (their like or repost is done when they come back, with a brief "Liked" or "Reposted" over the button), and Reply and Quote open the post on Bluesky. It works with posts from loaders such as [`@ascorbic/bluesky-loader`](https://www.npmjs.com/package/@ascorbic/bluesky-loader) or embeds such as [`@astro-community/astro-embed-bluesky`](https://www.npmjs.com/package/@astro-community/astro-embed-bluesky) (wrap the embed in the marked element). Only posts by your `allowedAuthors` can be liked or reposted through your site.

A **Follow** button: `AtmosphereFollow` shows "Follow @you.bsky.social on Bluesky →", a link to the account's Bluesky profile, and for signed-in readers it becomes a Follow button, showing "Following" once they do (a second press unfollows, as on Bluesky). Readers who aren't signed in just follow on Bluesky: they're never asked to sign in here for it.

```astro
---
import AtmosphereFollow from "astro-atmosphere-comments/AtmosphereFollow.astro";
---

<AtmosphereFollow account="you.bsky.social" />
```

`account` takes a handle or a DID (default: your `standardSite` publication's account), `label` replaces the wording and `class` styles the link; the handle and DID are looked up when the page is built. Only your `allowedAuthors` can be followed through your site (others stay a link, with a warning in the build), and the account's owner, who can't follow themselves, keeps the plain link. It needs `AtmosphereReactions` in your layout. A link of your own works too, marked with the account's DID and handle:

```astro
<a href="https://bsky.app/profile/you.bsky.social"
   data-atmosphere-follow="did:plc:…" data-atmosphere-follow-handle="you.bsky.social">Follow me on Bluesky</a>
```

**Matching buttons for a follow page.** On a page all about following (such as [Friendly Feed for Astro](https://github.com/saltedlolly/astro-friendly-feed)'s), `button` gives `AtmosphereSubscribe` and `AtmosphereFollow` a pair of matching buttons, with no menu: the Standard.site logo and "Subscribe to blog posts", and Bluesky's butterfly and "Follow on Bluesky". Both show to readers who aren't signed in: pressing one offers the sign-in form, then subscribes or follows once they're back. Once done, each shows "✓ Subscribed" or "✓ Following" with the reader's own avatar; a second press undoes it. `label` replaces the wording, and `class` styles the button. Nothing else changes: without `button`, both components work as above.

```astro
<AtmosphereSubscribe button />
<AtmosphereFollow button />
<AtmosphereFollow account="you.bsky.social" button label="Follow @you.bsky.social" />
```

**Publishing to Standard.site:** [Atmosphere Publishing for Astro](https://github.com/saltedlolly/astro-atmosphere-publishing) is the companion integration made to work with this one. It publishes your posts' Standard.site records, announces new posts on Bluesky and adds each page's `<link rel="site.standard.document">` tag, so the comment box finds each post's announcement without a `post` prop. Its `publicationFromState()` helper gives the `standardSite` option your publication (below). Other publishers work too, as long as they add that tag and set the record's `bskyPostRef`, as [Sequoia](https://sequoia.pub) does.

If you publish [Standard.site](https://standard.site) records, set the integration's `standardSite` option. Readers can then **subscribe** to your publication from your site, and read new posts in apps such as Leaflet or Standard Reader. `AtmosphereComments` shows a Subscribe button under each post, after Like, Repost and Quote, with a ⌄ menu: a note on what subscribing does, then View on Standard Reader and View on Leaflet. Beside it, a separate **Follow** button follows your publication's account on Bluesky, with its own ⌄ menu: "To see everything @you posts, follow on Bluesky.", View @you on Bluesky and View post on Bluesky (the post's thread). Readers who aren't signed in are offered the sign-in form by either, and subscribed or following once they're back. Feeds (RSS) aren't in it: they're a different thing, best offered on your own pages ([Friendly Feed for Astro](https://github.com/saltedlolly/astro-friendly-feed) makes a page for them).

The same button and menu can go anywhere, such as at the top of your blog's list of posts, with `AtmosphereSubscribe` (and `AtmosphereReactions` in your layout, which works the button and offers signing in):

```astro
---
import AtmosphereSubscribe from "astro-atmosphere-comments/AtmosphereSubscribe.astro";
---

<AtmosphereSubscribe
  align="end"
  links={[{ label: "Our page on Example Reader", href: "https://reader.example/p/example.com" }]}
/>
```

All its props are optional. `align="end"` lines the menu up with the button's right-hand edge, for a button near the right of the page (the default, `"start"`, lines it up on the left). `links` adds items to the end of the menu. Subscribing never follows: for that, put `<AtmosphereFollow menu />` beside it, the Follow button with its own menu, as under each post. (`copyUrl`, from before 0.9.0, and `bluesky`, from before 0.10.0, are ignored.) It shows nothing without the `standardSite` option, and needs JavaScript.

For a button of your own design instead (with `AtmosphereReactions` in your layout), mark it as below; it stays hidden without the option or JavaScript. Anyone not signed in is offered the sign-in form, and subscribed once they're back; a second press unsubscribes.

```astro
<button type="button" data-atmosphere-subscribe hidden>
  <span data-atmosphere-subscribe-label>Subscribe</span>
</button>
```

Without a `data-atmosphere-subscribe-label` element the button keeps your own content, and you show the state with `[aria-pressed="true"]` in your CSS.

So readers can see which account they're using, `AtmosphereReactions` also fills any element marked `data-atmosphere-account` (in your header, say) with the signed-in reader's avatar. Clicking it opens a small menu: "Signed in as @handle" and Sign out. When nobody's signed in it stays empty, so give it `hidden`:

```astro
<span data-atmosphere-account hidden></span>
```

### Trying it on your own computer

Run the dev server on `127.0.0.1` and open the site there, not at `localhost`:

```sh
npx astro dev --host 127.0.0.1
```

Locally the integration uses the protocol's development mode, so it works without a public address. Bluesky's approval screen will say a development app is asking, and sign-ins last only about a day; that's expected.

## Options

| Option | Required | What it does |
| --- | --- | --- |
| `clientName` | yes | Your site's name, given to readers' account hosts. (Bluesky's approval page shows your site's address instead, unless Bluesky has marked your site as trusted.) |
| `allowedAuthors` | yes | DIDs of the accounts whose posts can be commented on through your site. Comments from these accounts get the Author badge. |
| `logoUri` | | A square logo for the sign-in screen (absolute `https://` address). |
| `policyUri`, `tosUri` | | Your privacy policy and terms, shown on the sign-in screen. The privacy policy is also linked under the sign-in form. |
| `standardSite` | | `{ publication: "at://did:…/site.standard.publication/…" }`, your [Standard.site](https://standard.site) publication (a `feed` there, from before 0.9.0, is ignored). Turns on the Subscribe button (above), and makes Like under a post also recommend the post's record, when its page has `<link rel="site.standard.document">` (the button's tooltip says so); un-liking removes the recommend. Likes on comments stay Bluesky likes. Adds Standard.site's permission to the one approval. This package doesn't publish the records: use your own script or a publishing tool. |
| `hidden` | | Comments never to show: bsky.app post or profile addresses, AT URIs, handles or DIDs. Replies you hide in the Bluesky app, and posts with Bluesky's moderation labels (spam and so on), are left out anyway. |
| `base` | | Where the integration's routes live. Default `/atmosphere`. |
| `locale` | | The language of the wording, such as `"fr"` or `"pt-BR"` (see Languages). |
| `messages` | | Your own wording for any line, by its key in [`locales/en.json`](locales/en.json). |

## The component

| Prop | What it does |
| --- | --- |
| `post` | The announcement: bsky.app address or AT URI. Optional with Standard.site (above). |
| `label` | The sign-in overlay's heading when commenting. Default "Sign in to leave a comment". |
| `authorLabel` | The badge on your own comments. Default "Author". |
| `blueskyLink` | "Rather not sign in here? Respond on Bluesky →" in the sign-in overlay, linking to the announcement (with `u-syndication`, so microformats readers learn it's the post's copy on Bluesky). Default `true`; `blueskyLink={false}` hides it. |
| `locale`, `messages` | The same as the integration's options, for this one component. |
| `locale`, `messages` (also on `AtmosphereReactions`) | See Languages. |
| `credit` | A small "Powered by Atmosphere Comments for Astro" link at the end. Default `true`; set `credit={false}` to hide it. |

**Slots:** `after-box` goes between the comment box and the comments (a note about other ways to respond, say); the default slot goes after the comments (other responses, older comments).

**Layout, top to bottom:** likes and reposts, Like, Repost, Quote and the comment box, your `after-box` content, the comments, your default slot content.

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
- `atmosphere:hidden` after the announcement's author hides a comment (`detail`: `uri`).

## Security and privacy

- **Readers' sign-ins stay in their browsers.** The OAuth library (`@atproto/oauth-client-browser`) keeps the tokens in the browser's storage, together with a key the browser makes and won't let even the page's own code read out; the tokens only work with that key. Your server never receives them, sets no cookies and stores nothing about readers. Signing out cancels the sign-in at the reader's account host and deletes it from the browser.
- **What that does and doesn't promise.** Your server can't act for anyone, ever. While a reader has your page open, though, your page's code can use their sign-in, as with any web app they sign in to, so the code that runs matters: it's this package's open source code, and comments are only ever shown as plain text (links, @mentions and #hashtags become links; nothing is rendered as HTML). A [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) on your site adds a second line of defence.
- **What's checked before anything is sent** (by the browser code, `lib/client/account.ts`): only your announcements and the comments under them can be replied to, liked, reposted or quoted; only a reader's own replies under your announcements can be deleted; only your `standardSite` publication can be subscribed to, and only documents in its account recommended; only your `allowedAuthors` can be followed; only an announcement's author can hide comments under it.
- **What your server does:** it shows the threads, looks up accounts and suggestions, finds the links and mentions in a comment before it's posted, and passes on avatars and link pictures it has just shown. None of it needs to know who a reader is. Each route that calls Bluesky is rate-limited per address, with an overall cap; requests that aren't simple reads must come from your own pages (checked by `Origin`). Readers' addresses are used only for those limits, never stored.
- **Trade-off:** account hosts trust browser sign-ins less than ones kept on a server, so they last less long (Bluesky's currently last about two weeks), and there's no way for a site to sign everyone out at once. For a reader who'd rather not trust your server, that's the point.
- **People who'd rather not be shown publicly:** Bluesky's setting "Discourage apps from showing my account to logged-out users" is respected, as your page is public. For readers who aren't signed in, a comment from such an account shows as a blurred "Comment hidden" placeholder (made-up grey bars: no name, picture or words reach the page, only the comment's address), the replies under it stay, and the account appears in the faces of who liked and reposted as a faceless silhouette, so the counts still add up. Clicking the placeholder offers sign-in. Signed-in readers see these comments and faces as normal: their own browser fetches them with their own sign-in.
- **Moderation:** comments appear automatically. Hide one with Hide under it (signed in as the account that posted the announcement) or in the Bluesky app; it disappears here too. Show it again in the Bluesky app. You can also block the account, or add it to `hidden`.

## Limitations (for now)

- Needs an on-demand (server) adapter, for the few routes above. Serverless hosts should work, as nothing is stored, but haven't been tried.
- Rate limits are kept in memory, so they apply per server process.
- Quoting individual comments isn't supported.

If you only want readers to sign in with their Atmosphere account, without comments, see [AuthProto](https://www.npmjs.com/package/@fujocoded/authproto).

## Saying thanks

It's free to use (MIT), with no strings attached. If it's useful to you, I'd be grateful if you kept the small credit link, or linked to [saltedlolly.com](https://saltedlolly.com) somewhere on your site. You can also [sponsor me on GitHub](https://github.com/sponsors/saltedlolly) or [buy me a coffee on Ko-fi](https://ko-fi.com/saltedlolly).

## Credits

Made by [Olly Stedall](https://saltedlolly.com) for [saltedlolly.com](https://saltedlolly.com). The Atmosphere Account logo is from [Atmosphere Account](https://atmosphereaccount.com) ([@atmosphereaccount.com](https://bsky.app/profile/atmosphereaccount.com), [source](https://github.com/jobiwanken0bi/atmosphere-account)) by Joe Basser ([@joebasser.com](https://bsky.app/profile/joebasser.com)), MIT, © 2026 Joseph Basser. The Standard.site logo on the Subscribe button is from [Standard.site](https://standard.site) ([source](https://tangled.org/standard.site/standard.site)), MIT, © 2025 Standard.site.

## License

MIT
