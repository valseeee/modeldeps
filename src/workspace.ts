import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";
import type { InputHash } from "./types.js";
import { sha256 } from "./util.js";

/** Local input manifest: includes eval code/config, excludes generated/dependency trees.
 * External services, installed dependencies and OS state remain outside this evidence.
 */
export async function snapshotWorkspace(root: string, excludedArtifacts: string[]): Promise<InputHash[]> {
  const excluded = new Set([".git", "node_modules", ".modeldeps", "dist", "build", "coverage", "reports", ".venv", "venv"]);
  const results: InputHash[] = [];
  let bytes = 0;
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      const absolute = path.join(dir, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (excludedArtifacts.some(file => relative === file || relative === `${file}.sha256`)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        bytes += (await lstat(absolute)).size;
        if (bytes > 250_000_000 || results.length >= 50000) throw new Error("Workspace manifest resource budget exceeded");
        results.push({ path: relative, sha256: sha256(await readFile(absolute)) });
      }
    }
  }
  await walk(root);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}
