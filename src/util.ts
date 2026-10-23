import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf8");
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${filePath}: ${message}`);
  }
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  const datePart = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return false;
  const normalized = new Date(`${datePart}T00:00:00.000Z`);
  if (!Number.isFinite(normalized.getTime()) || normalized.toISOString().slice(0, 10) !== datePart) return false;
  if (value.length === 10) return true;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function daysUntil(dateString: string, now = new Date()): number {
  const target = new Date(`${dateString.slice(0, 10)}T00:00:00.000Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function normalizeRelative(root: string, filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/") || ".";
}

export function globToRegExp(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, "/");
  let out = "^";
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]!;
    const next = normalized[i + 1];
    if (char === "*" && next === "*") {
      if (normalized[i + 2] === "/") {
        out += "(?:.*/)?";
        i += 2;
      } else {
        out += ".*";
        i += 1;
      }
    } else if (char === "*") {
      out += "[^/]*";
    } else if (char === "?") {
      out += "[^/]";
    } else {
      out += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  out += "$";
  return new RegExp(out);
}

export function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(value));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Resolve a repository-relative file while rejecting traversal and symlinks in every path component.
 * Scanner findings use forward-slash paths so manifests stay portable across Windows and POSIX.
 */
export async function resolveSafeRepositoryFile(rootInput: string, relativePath: string): Promise<string> {
  if (typeof relativePath !== "string" || relativePath.trim() === "") {
    throw new Error("Repository input path must be a non-empty relative path.");
  }
  if (relativePath.includes("\\") || relativePath.startsWith("/") || /^[A-Za-z]:/.test(relativePath)) {
    throw new Error(`Repository input path must use portable relative paths with forward slashes: ${relativePath}`);
  }
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment.includes("\0"))) {
    throw new Error(`Repository input path contains an unsafe path segment: ${relativePath}`);
  }
  const root = await realpath(path.resolve(rootInput));
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`Repository root is not a regular directory: ${rootInput}`);
  }
  let current = root;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]!);
    const stat = await lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed in repository input paths: ${relativePath}`);
    if (index < segments.length - 1 && !stat.isDirectory()) {
      throw new Error(`Parent path component is not a directory: ${relativePath}`);
    }
    if (index === segments.length - 1 && !stat.isFile()) {
      throw new Error(`Repository input is not a regular file: ${relativePath}`);
    }
  }
  const relativeCheck = path.relative(root, current);
  if (relativeCheck === ".." || relativeCheck.startsWith(`..${path.sep}`) || path.isAbsolute(relativeCheck)) {
    throw new Error(`Repository input path escapes repository root: ${relativePath}`);
  }
  return current;
}
