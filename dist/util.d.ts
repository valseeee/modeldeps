export declare function sha256(content: string | Buffer): string;
export declare function readJsonFile<T>(filePath: string): Promise<T>;
export declare function isIsoDate(value: unknown): value is string;
export declare function daysUntil(dateString: string, now?: Date): number;
export declare function normalizeRelative(root: string, filePath: string): string;
export declare function globToRegExp(pattern: string): RegExp;
export declare function matchesAnyPattern(value: string, patterns: string[]): boolean;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function errorMessage(error: unknown): string;
/** Resolve a repository-relative file while rejecting traversal and symlinks in every path component.
 * Scanner findings use forward-slash paths so manifests stay portable across Windows and POSIX.
 */
export declare function resolveSafeRepositoryFile(rootInput: string, relativePath: string): Promise<string>;
