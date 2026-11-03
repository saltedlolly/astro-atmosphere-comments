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
   * Comments never to show: bsky.app post or profile addresses, AT URIs,
   * handles or DIDs (on top of replies hidden on Bluesky and moderation labels).
   */
  hidden?: string[];
};

export default function atmosphereComments(options: AtmosphereCommentsOptions): AstroIntegration;
