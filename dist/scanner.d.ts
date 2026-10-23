import type { ModelFinding, RegistrySnapshot } from "./types.js";
export interface ScanOptions {
    ignore?: string[];
    providers?: string[];
    maxBytes?: number;
    maxFiles?: number;
    timeoutMs?: number;
}
export declare function scanRepository(rootInput: string, registry: RegistrySnapshot, options?: ScanOptions): Promise<ModelFinding[]>;
