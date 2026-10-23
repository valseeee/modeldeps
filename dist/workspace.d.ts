import type { InputHash } from "./types.js";
/** Local input manifest: includes eval code/config, excludes generated/dependency trees.
 * External services, installed dependencies and OS state remain outside this evidence.
 */
export declare function snapshotWorkspace(root: string, excludedArtifacts: string[]): Promise<InputHash[]>;
