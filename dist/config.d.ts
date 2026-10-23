import { type Policy } from "./types.js";
export interface ModelDepsConfig {
    version: 1;
    providers: string[];
    policy: Policy;
    ignore: string[];
    evaluations: {
        default?: {
            command?: string;
            timeout_seconds?: number;
        };
    };
}
/** A deliberately small YAML subset parser: mappings, sequences, and scalar values only. */
export declare function parseYamlSubset(source: string): unknown;
export declare function mergeConfig(input: unknown): ModelDepsConfig;
export declare function loadConfig(root: string, explicitPath?: string): Promise<ModelDepsConfig>;
