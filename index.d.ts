import type { AstroIntegration } from "astro";

export type AtmosphereCommentsOptions = {
  /** Shown to readers on their account host's sign-in screen, e.g. "example.com". */
  clientName: string;
  /**
   * The DIDs of the accounts whose posts can be commented on through your site:
   * the account(s) that post your announcements (and your own, so your replies
   * get the Author badge).
   */
  allowedAuthors: string[];
  /** Where the integration's routes live. Default "/atmosphere". */
  base?: string;
  /** Square logo shown on the sign-in screen: an absolute https:// address. */
  logoUri?: string;
  /** Your privacy policy and terms, if you have them (absolute addresses). */
  policyUri?: string;
  tosUri?: string;
  /**
   * Your Standard.site publication, if you publish one. Turns on the Subscribe
   * button, and makes Like under a post also recommend its Standard.site
   * record. Readers are asked for this in the same approval as everything else.
   */
  standardSite?: {
    /** The publication record's AT URI: at://did:…/site.standard.publication/… */
    publication: string;
    /** Your feed's address, for the menu beside Subscribe, e.g. "/feed/". */
    feed?: string;
  };
  /**
   * Comments never to show: bsky.app post or profile addresses, AT URIs,
   * handles or DIDs (on top of replies hidden on Bluesky and moderation labels).
   */
  hidden?: string[];
  /**
   * The language of the wording, e.g. "fr" or "pt-BR". Default: Astro's own
   * i18n locale for the page, if you use Astro's i18n routing, else English.
   * The component's `locale` prop overrides it.
   */
  locale?: string;
  /**
   * Your own wording for any line, by its key in locales/en.json, e.g.
   * { "signIn.heading": "Sign in to join the conversation" }.
   */
  messages?: Record<string, string>;
};

export default function atmosphereComments(options: AtmosphereCommentsOptions): AstroIntegration;
