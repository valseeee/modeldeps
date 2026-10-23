import type { RegistrySnapshot } from "../types.js";
export declare function fetchOpenAILifecycle(apiKey?: string | undefined, now?: Date): Promise<Pick<RegistrySnapshot, "generated_at" | "models">>;
