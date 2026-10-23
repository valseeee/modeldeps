import type { ModelRecord, Provider, RegistrySnapshot } from "./types.js";
export declare function validateRegistry(value: unknown): RegistrySnapshot;
export declare function loadRegistry(filePath?: string): Promise<RegistrySnapshot>;
export declare function writeRegistry(filePath: string, registry: RegistrySnapshot): Promise<void>;
export declare function resolveModel(registry: RegistrySnapshot, provider: Provider, surface: string, modelId: string): ModelRecord | undefined;
export declare function findRecordsById(registry: RegistrySnapshot, modelId: string): ModelRecord[];
export declare function defaultRegistryPathForTests(): string;
export declare function pathExists(filePath: string): Promise<boolean>;
