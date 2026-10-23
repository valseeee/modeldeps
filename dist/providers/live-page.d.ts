import type { ModelRecord } from "../types.js";
export interface LivePageResult {
    generated_at: string;
    models: ModelRecord[];
    source_url: string;
    final_url: string;
    source_sha256: string;
    warnings: string[];
}
export declare function parseOfficialLifecyclePage(provider: "anthropic" | "google", html: string, sourceUrl: string, observedAt?: string, rawHash?: string): LivePageResult;
export declare function fetchOfficialLifecyclePage(provider: "anthropic" | "google", now?: Date): Promise<LivePageResult>;
