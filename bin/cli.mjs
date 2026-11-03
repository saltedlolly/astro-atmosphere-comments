#!/usr/bin/env node
// npx astro-atmosphere-comments keygen
//
// Creates your site's private signing key and adds it to .env (in the folder
// you run it from) as ATMOSPHERE_PRIVATE_JWK, without printing it. Account
// hosts check your site's requests against the public half, which the
// integration publishes at /atmosphere/jwks.json. It refuses if .env already
// has a key: a new key signs every reader out.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { JoseKey } from "@atproto/oauth-client-node";

const [command] = process.argv.slice(2);
if (command !== "keygen") {
  console.log("Usage: npx astro-atmosphere-comments keygen\n\nAdds a new signing key to .env as ATMOSPHERE_PRIVATE_JWK.");
  process.exit(command ? 1 : 0);
}

const envFile = ".env";
const existing = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
if (/^ATMOSPHERE_PRIVATE_JWK=.+/m.test(existing)) {
  console.error("ATMOSPHERE_PRIVATE_JWK is already set in .env; leaving it alone.");
  process.exit(1);
}

const key = await JoseKey.generate(["ES256"], "atmosphere-comments-1");
const line = `ATMOSPHERE_PRIVATE_JWK='${JSON.stringify(key.privateJwk)}'`;
const kept = existing.replace(/^ATMOSPHERE_PRIVATE_JWK=\s*$/m, "").replace(/\n*$/, existing ? "\n" : "");
writeFileSync(envFile, `${kept}${line}\n`, { mode: 0o600 });
console.log(
  "Added ATMOSPHERE_PRIVATE_JWK to .env (not shown). Set the same value on your server, keep .env out of Git, and keep a backup somewhere safe.",
);
