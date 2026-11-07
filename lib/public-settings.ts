// The integration's settings that are safe for readers' browsers: the
// site's address, the routes' base, its name and links, and its accounts.
// (The rest, such as `hidden`, stays on the server: lib/settings.ts.)
import settings from "virtual:atmosphere-comments/public-settings";

export type PublicSettings = {
  clientName: string;
  allowedAuthors: string[];
  /** Where the routes live, e.g. "/atmosphere" (no trailing slash). */
  base: string;
  /** The site's address, e.g. "https://saltedlolly.com" (no trailing slash). */
  site: string;
  logoUri?: string;
  policyUri?: string;
  tosUri?: string;
  /** The site's Standard.site publication: turns on Subscribe, and recommending with Like. */
  standardSite?: { publication: string; feed?: string };
};

export default settings as PublicSettings;
