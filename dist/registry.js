import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROVIDER_SOURCES } from "./providers/catalog.js";
import { isIsoDate, isRecord, readJsonFile } from "./util.js";
const STATUSES = new Set(["active", "preview", "deprecated", "retired", "unknown"]);
const PROVIDERS = new Set(["openai", "anthropic", "google"]);
const RISKS = new Set(["R0", "R1", "R2", "R3", "R4", "R5"]);
function validateSource(value, where, provider) {
    if (!isRecord(value))
        throw new Error(`${where}.source must be an object.`);
    const kind = value.kind;
    if (kind !== "official" && kind !== "maintainer" && kind !== "fixture") {
        throw new Error(`${where}.source.kind must be official, maintainer, or fixture.`);
    }
    if (!isIsoDate(value.observed_at))
        throw new Error(`${where}.source.observed_at must be an ISO date or timestamp.`);
    if (kind === "official") {
        if (typeof value.url !== "string" || !value.url.startsWith("https://")) {
            throw new Error(`${where}.source.url must be an HTTPS URL for official sources.`);
        }
        let sourceUrl;
        try {
            sourceUrl = new URL(value.url);
        }
        catch {
            throw new Error(`${where}.source.url must be a valid URL.`);
        }
        const providerInfo = PROVIDER_SOURCES.find((source) => source.provider === provider);
        if (!providerInfo || !providerInfo.officialHosts.includes(sourceUrl.hostname)) {
            throw new Error(`${where}.source.url host must be an official ${provider} host.`);
        }
    }
    if (kind === "fixture" && typeof value.url !== "string") {
        throw new Error(`${where}.source.url is required for fixture sources.`);
    }
    if (value.url !== undefined && typeof value.url !== "string")
        throw new Error(`${where}.source.url must be a string.`);
    if (value.sha256 !== undefined && (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.sha256))) {
        throw new Error(`${where}.source.sha256 must be a 64-character hex digest of directly fetched source bytes.`);
    }
    if (value.snapshot_sha256 !== undefined && (typeof value.snapshot_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(value.snapshot_sha256))) {
        throw new Error(`${where}.source.snapshot_sha256 must be a 64-character hex digest of the reviewed snapshot artifact.`);
    }
    if (value.parser_version !== undefined && (typeof value.parser_version !== "string" || !value.parser_version.trim()))
        throw new Error(`${where}.source.parser_version must be a non-empty string.`);
    const evidenceModes = new Set(["api-response", "live-page", "reviewed-snapshot", "fixture", "manual"]);
    if (value.evidence_mode !== undefined && (typeof value.evidence_mode !== "string" || !evidenceModes.has(value.evidence_mode))) {
        throw new Error(`${where}.source.evidence_mode is invalid.`);
    }
    if (value.evidence_mode === "reviewed-snapshot" && typeof value.snapshot_sha256 !== "string") {
        throw new Error(`${where}.source.snapshot_sha256 is required for reviewed-snapshot evidence.`);
    }
    if ((value.evidence_mode === "api-response" || value.evidence_mode === "live-page") && typeof value.sha256 !== "string") {
        throw new Error(`${where}.source.sha256 is required for directly fetched ${String(value.evidence_mode)} evidence.`);
    }
    return {
        kind,
        ...(typeof value.parser_version === "string" ? { parser_version: value.parser_version } : {}),
        observed_at: value.observed_at,
        ...(typeof value.url === "string" ? { url: value.url } : {}),
        ...(typeof value.sha256 === "string" ? { sha256: value.sha256 } : {}),
        ...(typeof value.snapshot_sha256 === "string" ? { snapshot_sha256: value.snapshot_sha256 } : {}),
        ...(typeof value.evidence_mode === "string" ? { evidence_mode: value.evidence_mode } : {})
    };
}
function validateReplacement(value, where) {
    if (!isRecord(value))
        throw new Error(`${where} must be an object.`);
    if (typeof value.model_id !== "string" || value.model_id.trim() === "")
        throw new Error(`${where}.model_id is required.`);
    if (value.authority !== "provider" && value.authority !== "community")
        throw new Error(`${where}.authority must be provider or community.`);
    if (value.provider !== undefined && (typeof value.provider !== "string" || !PROVIDERS.has(value.provider)))
        throw new Error(`${where}.provider must be openai, anthropic, or google.`);
    if (value.surface !== undefined && (typeof value.surface !== "string" || value.surface.trim() === ""))
        throw new Error(`${where}.surface must be a non-empty string.`);
    if (value.risk !== undefined && (typeof value.risk !== "string" || !RISKS.has(value.risk)))
        throw new Error(`${where}.risk must be R0 through R5.`);
    if (value.changes !== undefined && (!Array.isArray(value.changes) || !value.changes.every((item) => typeof item === "string"))) {
        throw new Error(`${where}.changes must be an array of strings.`);
    }
    return {
        model_id: value.model_id,
        authority: value.authority,
        ...(typeof value.provider === "string" ? { provider: value.provider } : {}),
        ...(typeof value.surface === "string" ? { surface: value.surface } : {}),
        ...(typeof value.risk === "string" ? { risk: value.risk } : {}),
        ...(Array.isArray(value.changes) ? { changes: value.changes } : {})
    };
}
function validateModel(value, index) {
    const where = `models[${index}]`;
    if (!isRecord(value))
        throw new Error(`${where} must be an object.`);
    if (typeof value.provider !== "string" || !PROVIDERS.has(value.provider))
        throw new Error(`${where}.provider must be openai, anthropic, or google.`);
    if (typeof value.surface !== "string" || value.surface.trim() === "")
        throw new Error(`${where}.surface is required.`);
    if (typeof value.model_id !== "string" || value.model_id.trim() === "")
        throw new Error(`${where}.model_id is required.`);
    if (typeof value.status !== "string" || !STATUSES.has(value.status))
        throw new Error(`${where}.status is invalid.`);
    if (value.announced_at !== undefined && !isIsoDate(value.announced_at))
        throw new Error(`${where}.announced_at must be an ISO date.`);
    if (value.shutdown_at !== undefined && !isIsoDate(value.shutdown_at))
        throw new Error(`${where}.shutdown_at must be an ISO date.`);
    if (value.shutdown_date_kind !== undefined && !["confirmed", "earliest-possible", "tentative"].includes(String(value.shutdown_date_kind)))
        throw new Error(`${where}.shutdown_date_kind must be confirmed, earliest-possible, or tentative.`);
    if (!Array.isArray(value.recommended_replacements))
        throw new Error(`${where}.recommended_replacements must be an array.`);
    const replacements = value.recommended_replacements.map((item, i) => validateReplacement(item, `${where}.recommended_replacements[${i}]`));
    const source = validateSource(value.source, where, value.provider);
    const replacementSource = value.replacement_source === undefined
        ? undefined
        : validateSource(value.replacement_source, `${where}.replacement_source`, value.provider);
    if (value.notes !== undefined && typeof value.notes !== "string")
        throw new Error(`${where}.notes must be a string.`);
    return {
        provider: value.provider,
        surface: value.surface,
        model_id: value.model_id,
        status: value.status,
        recommended_replacements: replacements,
        source,
        ...(replacementSource ? { replacement_source: replacementSource } : {}),
        ...(typeof value.announced_at === "string" ? { announced_at: value.announced_at } : {}),
        ...(typeof value.shutdown_at === "string" ? { shutdown_at: value.shutdown_at } : {}),
        ...(typeof value.shutdown_date_kind === "string" ? { shutdown_date_kind: value.shutdown_date_kind } : {}),
        ...(typeof value.notes === "string" ? { notes: value.notes } : {})
    };
}
export function validateRegistry(value) {
    if (!isRecord(value))
        throw new Error("Registry must be a JSON object.");
    if (value.schema_version !== "0.1")
        throw new Error("Registry schema_version must be 0.1.");
    if (!isIsoDate(value.generated_at))
        throw new Error("Registry generated_at must be an ISO date or timestamp.");
    if (!Array.isArray(value.models))
        throw new Error("Registry models must be an array.");
    const models = value.models.map((model, index) => validateModel(model, index));
    const seen = new Set();
    for (const model of models) {
        const key = `${model.provider}\0${model.surface}\0${model.model_id}`;
        if (seen.has(key))
            throw new Error(`Duplicate registry identity: ${model.provider}/${model.surface}/${model.model_id}`);
        seen.add(key);
    }
    const sync = {};
    if (value.last_successful_sync !== undefined) {
        if (!isRecord(value.last_successful_sync))
            throw new Error("Invalid last_successful_sync.");
        for (const [provider, timestamp] of Object.entries(value.last_successful_sync)) {
            if (!PROVIDERS.has(provider) || !isIsoDate(timestamp))
                throw new Error("Invalid provider sync timestamp.");
            sync[provider] = timestamp;
        }
    }
    return { schema_version: "0.1", generated_at: value.generated_at, models, ...(Object.keys(sync).length ? { last_successful_sync: sync } : {}) };
}
export async function loadRegistry(filePath) {
    const defaultPath = new URL("../data/registry.json", import.meta.url);
    const resolved = filePath ? path.resolve(filePath) : fileURLToPath(defaultPath);
    const raw = await readJsonFile(resolved);
    return validateRegistry(raw);
}
export async function writeRegistry(filePath, registry) {
    const validated = validateRegistry(registry);
    const fs = await import("node:fs/promises");
    const target = path.resolve(filePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${(await import("node:crypto")).randomUUID()}.tmp`;
    try {
        await fs.writeFile(temporary, `${JSON.stringify(validated, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
        await loadRegistry(temporary);
        await fs.rename(temporary, target);
    }
    finally {
        await fs.rm(temporary, { force: true });
    }
}
export function resolveModel(registry, provider, surface, modelId) {
    if (provider === "unknown")
        return undefined;
    return registry.models.find((model) => model.provider === provider && model.surface === surface && model.model_id === modelId);
}
export function findRecordsById(registry, modelId) {
    return registry.models.filter((model) => model.model_id === modelId);
}
export function defaultRegistryPathForTests() {
    return fileURLToPath(new URL("../data/registry.json", import.meta.url));
}
export async function pathExists(filePath) {
    try {
        await access(filePath);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=registry.js.map