# Changelog

## 0.2.0 (4 November 2026)

- The sign-in form is shown straight away under each post: a handle box with the Atmosphere logo and a **Sign in with Atmosphere** button. The "Respond with your Atmosphere Account" button that opened it is gone.
- `label` is now the form's heading (default "Sign in to leave a comment, like or repost"). If you set it for the old button's small text, change or remove it.
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
