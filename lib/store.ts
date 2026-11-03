// Small file-based stores for sign-in data, one JSON file per key.
//
// They hold OAuth tokens, so the folder and files are readable only by the
// site's own user (0700 / 0600), and file names are hashes, never handles or
// cookie values. Set ATMOSPHERE_DATA_DIR to a folder outside the release, so
// deploys don't sign everyone out (default: .data/atmosphere in the project).
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getSecret } from "astro:env/server";

const root = path.resolve(getSecret("ATMOSPHERE_DATA_DIR") || ".data/atmosphere");

const fileFor = (folder: string, key: string) =>
  path.join(root, folder, `${createHash("sha256").update(key).digest("hex")}.json`);

type Stored<V> = { value: V; expiresAt?: number };

export function fileStore<V>(folder: string, lifetimeMs?: number) {
  return {
    async get(key: string): Promise<V | undefined> {
      try {
        const stored = JSON.parse(await readFile(fileFor(folder, key), "utf8")) as Stored<V>;
        if (stored.expiresAt && stored.expiresAt < Date.now()) {
          await rm(fileFor(folder, key), { force: true });
          return undefined;
        }
        return stored.value;
      } catch {
        return undefined;
      }
    },
    async set(key: string, value: V): Promise<void> {
      const file = fileFor(folder, key);
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const stored: Stored<V> = { value, ...(lifetimeMs && { expiresAt: Date.now() + lifetimeMs }) };
      // Write then rename, so a crash never leaves half a file.
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(stored), { mode: 0o600 });
      await rename(temporary, file);
    },
    async del(key: string): Promise<void> {
      await rm(fileFor(folder, key), { force: true });
    },
  };
}
