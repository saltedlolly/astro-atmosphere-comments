// Atmosphere comments: an Astro integration that lets readers sign in with
// their own Atmosphere (AT Protocol) account and comment on, like, repost or
// quote a post without leaving the page. Comments are ordinary Bluesky
// replies to the post's announcement, written to the reader's own account, so
// they can delete them there at any time.
//
// Sign-in uses AT Protocol OAuth straight to the reader's own account host,
// as a browser client: the sign-in is kept only in the reader's browser, and
// the site's server never sees it, so the server can't act for anyone.
// Signing out cancels it at the reader's host. See lib/client/account.ts.
//
// It adds /oauth-client-metadata.json at the site's root (what account hosts
// read to know the site), and these routes under `base` (default /atmosphere),
// none of which act for a reader:
//   callback       the page readers come back to after approving
//   identity       looks up an account for signing in
//   profile        a reader's public profile, for the comment box
//   richtext       links, @mentions and #hashtags in a comment, before it's posted
//   following      whether an account follows one of the site's accounts
//   post           the announcement, for the Quote preview
//   media          avatars and link-card pictures, via this site
//   typeahead      account suggestions as the reader types
//   thread         the comments, likes and reposts to show
// and two components: AtmosphereComments.astro under each post, and
// AtmosphereReactions.astro once in the layout.
//
// It needs an on-demand (server) adapter such as @astrojs/node.
import { fileURLToPath } from "node:url";

const VIRTUAL_ID = "virtual:atmosphere-comments/settings";
// The settings that are safe for readers' browsers (lib/public-settings.ts).
const PUBLIC_ID = "virtual:atmosphere-comments/public-settings";

const ROUTES = {
  callback: "callback.astro",
  identity: "identity.ts",
  profile: "profile.ts",
  richtext: "richtext.ts",
  following: "following.ts",
  post: "post.ts",
  media: "media.ts",
  typeahead: "typeahead.ts",
  thread: "thread.ts",
};

const DID = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/;

/**
 * @param {import("./index").AtmosphereCommentsOptions} options
 * @returns {import("astro").AstroIntegration}
 */
export default function atmosphereComments(options) {
  if (!options?.clientName) throw new Error("atmosphere-comments: `clientName` is required.");
  const allowedAuthors = options.allowedAuthors ?? [];
  if (!allowedAuthors.length || !allowedAuthors.every((did) => DID.test(did))) {
    throw new Error(
      "atmosphere-comments: `allowedAuthors` must list the DIDs (did:plc:… or did:web:…) of the accounts that post your announcements.",
    );
  }
  const base = `/${(options.base ?? "/atmosphere").replace(/^\/+|\/+$/g, "")}`;
  return {
    name: "atmosphere-comments",
    hooks: {
      "astro:config:setup": ({ config, injectRoute, updateConfig }) => {
        if (!config.site) throw new Error("atmosphere-comments: set `site` in astro.config (your site's address).");
        if (config.output === "static" && !config.adapter) {
          throw new Error("atmosphere-comments needs a server adapter, such as @astrojs/node.");
        }
        /** @type {import("./lib/settings").AtmosphereSettings} */
        const settings = {
          clientName: options.clientName,
          allowedAuthors,
          base,
          site: config.site.replace(/\/+$/, ""),
          logoUri: options.logoUri,
          policyUri: options.policyUri,
          tosUri: options.tosUri,
          hidden: options.hidden ?? [],
          locale: options.locale,
          messages: options.messages ?? {},
        };

        // The client metadata lives at the address account hosts treat as the
        // convention, so Bluesky's approval page names the app by the site's
        // address alone (saltedlolly.com) rather than the full file address.
        injectRoute({
          pattern: "/oauth-client-metadata.json",
          entrypoint: fileURLToPath(new URL("./routes/client-metadata.json.ts", import.meta.url)),
          prerender: false,
        });

        for (const [path, file] of Object.entries(ROUTES)) {
          injectRoute({
            pattern: `${base}/${path}`,
            entrypoint: fileURLToPath(new URL(`./routes/${file}`, import.meta.url)),
            prerender: false,
          });
        }

        const publicSettings = {
          clientName: settings.clientName,
          allowedAuthors,
          base,
          site: settings.site,
          logoUri: settings.logoUri,
          policyUri: settings.policyUri,
          tosUri: settings.tosUri,
        };

        // The routes and components read the settings from virtual modules.
        updateConfig({
          vite: {
            plugins: [
              {
                name: "atmosphere-comments-settings",
                resolveId: (id) => (id === VIRTUAL_ID || id === PUBLIC_ID ? `\0${id}` : undefined),
                load: (id) =>
                  id === `\0${VIRTUAL_ID}`
                    ? `export default ${JSON.stringify(settings)};`
                    : id === `\0${PUBLIC_ID}`
                      ? `export default ${JSON.stringify(publicSettings)};`
                      : undefined,
              },
            ],
          },
        });
      },
    },
  };
}
