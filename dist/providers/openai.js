import { boundedText } from "./http.js";
import { sha256, isIsoDate } from "../util.js";
export async function fetchOpenAILifecycle(apiKey = process.env.OPENAI_API_KEY, now = new Date()) {
    if (!apiKey)
        throw new Error("OPENAI_API_KEY is required for OpenAI registry sync. Normal scan/check commands do not need it.");
    const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(20_000)
    });
    if (!response.ok)
        throw new Error(`OpenAI Models API returned HTTP ${response.status}. Check the key and network, then retry.`);
    if (!/^application\/json(?:;|$)/i.test(response.headers.get("content-type") ?? ""))
        throw new Error("OpenAI response is not JSON.");
    const rawText = await boundedText(response, 4_000_000);
    let payload;
    try {
        payload = JSON.parse(rawText);
    }
    catch {
        throw new Error("OpenAI Models API response was not valid JSON.");
    }
    if (!Array.isArray(payload.data))
        throw new Error("OpenAI Models API response did not contain a data array.");
    if (payload.has_more === true || typeof payload.next_page === "string")
        throw new Error("Unexpected paginated Models API response; source completeness is not established.");
    if (payload.data.length > 20000)
        throw new Error("Models API record limit exceeded.");
    if (payload.data.length === 0)
        throw new Error("OpenAI returned an empty model inventory; refusing sync.");
    const seen = new Set();
    for (const item of payload.data) {
        if (!item || typeof item.id !== "string" || !item.id.trim() || item.id.trim() !== item.id || /[\x00-\x1f]/.test(item.id) || seen.has(item.id))
            throw new Error("Invalid or duplicate OpenAI model ID.");
        seen.add(item.id);
        if (item.shutdown_date != null && (typeof item.shutdown_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.shutdown_date) || !isIsoDate(item.shutdown_date)))
            throw new Error("Invalid OpenAI shutdown_date.");
    }
    const observedAt = now.toISOString();
    const responseHash = sha256(rawText);
    const models = [];
    for (const item of payload.data) {
        if (typeof item.id !== "string" || typeof item.shutdown_date !== "string" || !isIsoDate(item.shutdown_date))
            continue;
        const shutdownAt = item.shutdown_date.slice(0, 10);
        const isRetired = new Date(`${shutdownAt}T00:00:00.000Z`).getTime() <= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        models.push({
            provider: "openai",
            surface: "openai-api",
            model_id: item.id,
            status: isRetired ? "retired" : "deprecated",
            shutdown_at: shutdownAt,
            shutdown_date_kind: "confirmed",
            recommended_replacements: [],
            source: {
                kind: "official",
                evidence_mode: "api-response",
                parser_version: "0.4.0.2",
                url: "https://api.openai.com/v1/models",
                observed_at: observedAt,
                sha256: responseHash
            },
            notes: "Imported from the official Models API shutdown_date field. No replacement was inferred."
        });
    }
    return { generated_at: observedAt, models };
}
//# sourceMappingURL=openai.js.map