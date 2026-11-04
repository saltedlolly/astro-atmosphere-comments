// The integration's settings, as the routes and component see them (from the
// virtual module the integration adds; see index.ts).
import settings from "virtual:atmosphere-comments/settings";

export type AtmosphereSettings = {
  clientName: string;
  allowedAuthors: string[];
  /** Where the routes live, e.g. "/atmosphere" (no trailing slash). */
  base: string;
  /** The site's address, e.g. "https://saltedlolly.com" (no trailing slash). */
  site: string;
  logoUri?: string;
  policyUri?: string;
  tosUri?: string;
  hidden?: string[];
  locale?: string;
  messages?: Record<string, string>;
};

export default settings as AtmosphereSettings;
