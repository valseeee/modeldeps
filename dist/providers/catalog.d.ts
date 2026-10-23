import type { Provider } from "../types.js";
export interface ProviderSourceInfo {
    provider: Exclude<Provider, "unknown">;
    surface: string;
    lifecycleDocs: string;
    syncMode: "authenticated-api" | "live-html" | "reviewed-snapshot";
    requiredEnvironment?: string;
    officialHosts: string[];
}
export declare const PROVIDER_SOURCES: ProviderSourceInfo[];
