export const PROVIDER_SOURCES = [
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
//# sourceMappingURL=catalog.js.map