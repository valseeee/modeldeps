import { readFile } from "node:fs/promises";
import { validateRegistry } from "../registry.js";
import { isIsoDate, isRecord, sha256 } from "../util.js";
import { PROVIDER_SOURCES } from "./catalog.js";
export async function importReviewedSnapshot(filePath, expectedProvider) {
    const raw = await readFile(filePath, "utf8");
    let input;
    try {
        input = JSON.parse(raw);
    }
    catch (error) {
        throw new Error(`Snapshot must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!isRecord(input))
        throw new Error("Reviewed snapshot must be a JSON object.");
    if (input.provider !== expectedProvider)
        throw new Error(`Snapshot provider must be ${expectedProvider}.`);
    if (typeof input.source_url !== "string" || !isIsoDate(input.observed_at) || !Array.isArray(input.models)) {
        throw new Error("Snapshot requires a valid source_url, ISO observed_at, and models[] array.");
    }
    const sourceInfo = PROVIDER_SOURCES.find((source) => source.provider === expectedProvider);
    if (!sourceInfo)
        throw new Error(`No official source configuration exists for ${expectedProvider}.`);
    let parsedUrl;
    try {
        parsedUrl = new URL(input.source_url);
    }
    catch {
        throw new Error("source_url must be a valid URL.");
    }
    if (parsedUrl.protocol !== "https:" || !sourceInfo.officialHosts.includes(parsedUrl.hostname)) {
        throw new Error(`source_url host must be an official ${expectedProvider} host: ${sourceInfo.officialHosts.join(", ")}.`);
    }
    if (input.surface !== undefined && (typeof input.surface !== "string" || input.surface.trim() === "")) {
        throw new Error("surface, when supplied, must be a non-empty string.");
    }
    input.models.forEach((model, index) => {
        if (!isRecord(model))
            throw new Error(`models[${index}] must be an object.`);
        if (typeof model.model_id !== "string" || model.model_id.trim() === "")
            throw new Error(`models[${index}].model_id is required.`);
        if (!isIsoDate(model.shutdown_at) && model.shutdown_at !== undefined)
            throw new Error(`models[${index}].shutdown_at must be an ISO date.`);
        if (model.shutdown_date_kind !== undefined && !["confirmed", "earliest-possible", "tentative"].includes(String(model.shutdown_date_kind)))
            throw new Error(`models[${index}].shutdown_date_kind is invalid.`);
        if (!isIsoDate(model.announced_at) && model.announced_at !== undefined)
            throw new Error(`models[${index}].announced_at must be an ISO date.`);
    });
    const snapshot = input;
    // This digest is deliberately named snapshot_sha256: it hashes this curated JSON file,
    // not the official HTML page at source_url. The page URL and review time are recorded separately.
    const snapshotHash = sha256(raw);
    const models = snapshot.models.map((model) => {
        const provenance = {
            kind: "official",
            evidence_mode: "reviewed-snapshot",
            parser_version: "0.4.0.2",
            url: snapshot.source_url,
            observed_at: snapshot.observed_at,
            snapshot_sha256: snapshotHash
        };
        const replacements = model.recommended_replacements ?? [];
        return {
            provider: expectedProvider,
            surface: typeof snapshot.surface === "string" ? snapshot.surface : sourceInfo.surface,
            model_id: model.model_id,
            status: model.status,
            recommended_replacements: replacements,
            source: provenance,
            ...(replacements.length > 0 ? { replacement_source: provenance } : {}),
            ...(model.announced_at ? { announced_at: model.announced_at } : {}),
            ...(model.shutdown_at ? { shutdown_at: model.shutdown_at } : {}),
            ...(model.shutdown_at ? { shutdown_date_kind: model.shutdown_date_kind ?? snapshot.shutdown_date_kind ?? "confirmed" } : {}),
            ...(model.notes ? { notes: model.notes } : {})
        };
    });
    const validated = validateRegistry({ schema_version: "0.1", generated_at: snapshot.observed_at, models });
    return { generated_at: validated.generated_at, models: validated.models };
}
//# sourceMappingURL=reviewed-snapshot.js.map