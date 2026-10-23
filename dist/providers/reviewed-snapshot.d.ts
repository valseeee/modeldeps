import type { Provider, RegistrySnapshot } from "../types.js";
export declare function importReviewedSnapshot(filePath: string, expectedProvider: Exclude<Provider, "unknown">): Promise<Pick<RegistrySnapshot, "generated_at" | "models">>;
