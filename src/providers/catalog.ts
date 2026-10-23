import type { Provider } from "../types.js";

export interface ProviderSourceInfo {
  provider: Exclude<Provider, "unknown">;
  surface: string;
  lifecycleDocs: string;
  syncMode: "authenticated-api" | "live-html" | "reviewed-snapshot";
  requiredEnvironment?: string;
  officialHosts: string[];
}

export const PROVIDER_SOURCES: ProviderSourceInfo[] = [
  {
    provider: "openai",
    surface: "openai-api",
    lifecycleDocs: "https://developers.openai.com/api/docs/deprecations",
    syncMode: "authenticated-api",
    requiredEnvironment: "OPENAI_API_KEY",
    officialHosts: ["api.openai.com", "developers.openai.com", "platform.openai.com"]
  },
  {
    provider: "anthropic",
    surface: "anthropic-api",
    lifecycleDocs: "https://platform.claude.com/docs/en/about-claude/model-deprecations",
    syncMode: "live-html",
    officialHosts: ["docs.anthropic.com", "www.anthropic.com", "platform.claude.com"]
  },
  {
    provider: "google",
    surface: "gemini-api",
    lifecycleDocs: "https://ai.google.dev/gemini-api/docs/deprecations",
    syncMode: "live-html",
    officialHosts: ["ai.google.dev", "cloud.google.com", "developers.googleblog.com"]
  }
];
