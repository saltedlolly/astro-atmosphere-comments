// Atmosphere comments: an Astro integration that lets readers sign in with
// their own Atmosphere (AT Protocol) account and comment on, like, repost or
// quote a post without leaving the page. Comments are ordinary Bluesky
// replies to the post's announcement, written to the reader's own account, so
// they can delete them there at any time.
//
// Sign-in uses AT Protocol OAuth straight to the reader's own account host:
// no third-party login service is involved. This site only ever holds a
// grant to create posts and to create and delete likes and reposts, plus, if
// a reader allows it when they first delete a comment, to delete posts (see
// SCOPE and DELETE_SCOPE in lib/oauth.ts).
//
// It adds /oauth-client-metadata.json at the site's root (what account hosts
// read to know the site), and these routes under `base` (default /atmosphere):
//   jwks.json                        the public half of the site's signing key
//   login (POST)                     starts sign-in with the reader's handle
//   callback                         where the reader's host sends them back
//   logout (POST)                    signs out and revokes the site's grant
//   me                               who's signed in (for the comment box)
//   comment (POST)                   posts a comment (or quote post) as the reader
//   state                            whether the reader has liked or reposted
//   react (POST)                     likes or reposts, or undoes that
//   post                             the announcement, for the Quote preview
//   media                            avatars and link-card pictures, via this site
//   typeahead                        @mention suggestions as the reader types
//   thread                           the comments, likes and reposts to show
// and a component, AtmosphereComments.astro, to put under each post.
//
// It needs an on-demand (server) adapter such as @astrojs/node.
import { fileURLToPath } from "node:url";

const VIRTUAL_ID = "virtual:atmosphere-comments/settings";

const ROUTES = {
  "jwks.json": "jwks.json.ts",
  login: "login.ts",
  callback: "callback.ts",
  logout: "logout.ts",
  me: "me.ts",
  comment: "comment.ts",
  state: "state.ts",
  react: "react.ts",
  delete: "delete.ts",
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

        // The routes and component read the settings from a virtual module.
        updateConfig({
          vite: {
            plugins: [
              {
                name: "atmosphere-comments-settings",
                resolveId: (id) => (id === VIRTUAL_ID ? `\0${VIRTUAL_ID}` : undefined),
                load: (id) => (id === `\0${VIRTUAL_ID}` ? `export default ${JSON.stringify(settings)};` : undefined),
              },
            ],
          },
        });
      },
    },
  };
}
