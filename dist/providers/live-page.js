import { boundedText } from "./http.js";
import { validateRegistry } from "../registry.js";
import { isIsoDate, sha256 } from "../util.js";
import { PROVIDER_SOURCES } from "./catalog.js";
function decodeEntities(value) {
    return value
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)))
        .replace(/&#x([\da-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}
function cellText(html) {
    return decodeEntities(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ").trim());
}
function parseTables(html) {
    const beforeTableHeadings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
    const tables = [];
    for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
        const tableIndex = tableMatch.index ?? 0;
        const headingMatch = [...beforeTableHeadings].reverse().find((heading) => (heading.index ?? 0) < tableIndex);
        const tableHtml = tableMatch[1] ?? "";
        const rows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...(row[1] ?? "").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => cellText(cell[1] ?? ""))).filter((row) => row.length > 0);
        if (rows.length < 2)
            continue;
        tables.push({ headers: rows[0].map((v) => v.toLowerCase()), rows: rows.slice(1), heading: headingMatch ? cellText(headingMatch[1] ?? "") : "" });
    }
    return tables;
}
function column(headers, patterns) {
    return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}
const MONTHS = {
    january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12"
};
function parseDate(text) {
    const value = text.trim();
    if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))
        return isIsoDate(value) ? value.slice(0, 10) : undefined;
    const match = value.match(/(?:not sooner than\s+|tentative(?: retirement)? date[:\s]*)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (!match)
        return undefined;
    const month = MONTHS[match[1].toLowerCase()];
    if (!month)
        return undefined;
    const result = `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
    return isIsoDate(result) ? result : undefined;
}
function statusFromText(text) {
    const value = text.toLowerCase().trim();
    if (value === "retired" || value.includes("already retired"))
        return "retired";
    if (value === "deprecated")
        return "deprecated";
    if (value === "active")
        return "active";
    if (value === "preview")
        return "preview";
    // Do not silently equate provider-specific "legacy" semantics with deprecated.
    return "unknown";
}
function modelId(value) {
    const text = value.trim().replace(/^`|`$/g, "");
    if (!text || /^(?:n\/a|none|not available|no shutdown date announced|to be announced)$/i.test(text))
        return undefined;
    // Some official tables append explanatory parentheticals after the canonical model ID.
    // Accept only a model-like first token (must contain a separator), never a guessed display name.
    const match = text.match(/^([A-Za-z0-9][A-Za-z0-9._:-]*)/);
    const candidate = match?.[1];
    if (!candidate || !/[-._:]/.test(candidate))
        return undefined;
    return candidate;
}
function replacements(value, provider, surface) {
    const id = modelId(value);
    if (!id)
        return [];
    return [{ model_id: id, provider, surface, authority: "provider" }];
}
export function parseOfficialLifecyclePage(provider, html, sourceUrl, observedAt = new Date().toISOString(), rawHash = sha256(html)) {
    const sourceInfo = PROVIDER_SOURCES.find((item) => item.provider === provider);
    if (!sourceInfo)
        throw new Error(`No official source configured for ${provider}.`);
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== "https:" || !sourceInfo.officialHosts.includes(parsedUrl.hostname)) {
        throw new Error(`Live source URL must use an official ${provider} host.`);
    }
    const tables = parseTables(html);
    const models = new Map();
    const warnings = [];
    const source = {
        kind: "official",
        evidence_mode: "live-page",
        parser_version: "0.4.0.2",
        url: sourceUrl,
        observed_at: observedAt,
        sha256: rawHash
    };
    for (const table of tables) {
        const modelCol = column(table.headers, provider === "anthropic" ? [/api model name/, /model name/] : [/^model$/, /model name/]);
        if (modelCol < 0)
            continue;
        const statusCol = provider === "anthropic" ? column(table.headers, [/current state/, /^status$/]) : -1;
        const deprecatedCol = provider === "anthropic" ? column(table.headers, [/^deprecated$/]) : -1;
        const shutdownCol = column(table.headers, provider === "anthropic" ? [/tentative retirement date/, /retirement date/, /shutdown date/] : [/shutdown date/]);
        const replacementCol = column(table.headers, [/recommended replacement/]);
        const hasLifecycleColumns = statusCol >= 0 || shutdownCol >= 0;
        if (!hasLifecycleColumns)
            continue;
        for (const row of table.rows) {
            const id = modelId(row[modelCol] ?? "");
            if (!id)
                throw new Error("Lifecycle table contains a row without a canonical model ID.");
            if (row.length !== table.headers.length)
                throw new Error("Lifecycle table structure changed: missing cells.");
            if (models.size >= 2000)
                throw new Error("Lifecycle row count exceeds safety limit.");
            const dateText = shutdownCol >= 0 ? (row[shutdownCol] ?? "") : "";
            const shutdownAt = parseDate(dateText);
            if (dateText && !shutdownAt && !/^(?:n\/a|none|no shutdown date announced|to be announced|-)$/i.test(dateText.trim()))
                throw new Error(`Unrecognized shutdown date for ${id}: ${dateText}`);
            if (models.has(id))
                throw new Error(`Duplicate model row: ${id}`);
            const statusText = statusCol >= 0 ? (row[statusCol] ?? "") : "";
            let status = statusCol >= 0 ? statusFromText(statusText) : (shutdownAt ? "deprecated" : (/preview/i.test(table.heading) || /preview/i.test(id) ? "preview" : "active"));
            if (provider === "google" && shutdownAt)
                status = "deprecated"; // Google dates are earliest-possible, never proof of shutdown.
            const dateKind = shutdownAt ? (provider === "google" ? "earliest-possible" : (/not sooner than|tentative/i.test(dateText) || /tentative retirement date/.test(table.headers[shutdownCol] ?? "") ? "tentative" : "confirmed")) : undefined;
            const announcedAt = deprecatedCol >= 0 ? parseDate(row[deprecatedCol] ?? "") : undefined;
            const replacementList = replacementCol >= 0 ? replacements(row[replacementCol] ?? "", provider, sourceInfo.surface) : [];
            const record = {
                provider,
                surface: sourceInfo.surface,
                model_id: id,
                status,
                recommended_replacements: replacementList,
                source,
                ...(announcedAt ? { announced_at: announcedAt } : {}),
                ...(shutdownAt ? { shutdown_at: shutdownAt, shutdown_date_kind: dateKind } : {}),
                ...(statusText.toLowerCase() === "legacy" ? { notes: "Provider labels this model legacy; ModelDeps preserves that distinction as status=unknown rather than guessing equivalence." } : {}),
                ...(provider === "google" && shutdownAt ? { notes: "Google documents this as the earliest possible shutdown date. A past date alone does not prove the endpoint is already disabled." } : {})
            };
            models.set(id, record);
        }
    }
    // Anthropic also documents replacements in a separate deprecation-history table.
    // Enrich only model IDs already found in an explicit lifecycle table; never create an ungrounded model.
    if (provider === "anthropic") {
        for (const table of tables) {
            const deprecatedModelCol = column(table.headers, [/deprecated model/]);
            const replacementCol = column(table.headers, [/recommended replacement/]);
            if (deprecatedModelCol < 0 || replacementCol < 0)
                continue;
            for (const row of table.rows) {
                const id = modelId(row[deprecatedModelCol] ?? "");
                const replacement = replacements(row[replacementCol] ?? "", provider, sourceInfo.surface);
                if (!id || replacement.length === 0)
                    continue;
                const existing = models.get(id);
                if (existing)
                    models.set(id, { ...existing, recommended_replacements: replacement, replacement_source: source });
            }
        }
    }
    const minimum = provider === "anthropic" ? 5 : 5;
    if (models.size < minimum) {
        throw new Error(`Official ${provider} page parser found only ${models.size} model rows (minimum ${minimum}). Refusing to update registry; page markup may have changed.`);
    }
    const snapshot = {
        generated_at: observedAt,
        models: [...models.values()].sort((a, b) => a.model_id.localeCompare(b.model_id))
    };
    validateRegistry({ schema_version: "0.1", ...snapshot });
    return { ...snapshot, source_url: sourceUrl, final_url: sourceUrl, source_sha256: rawHash, warnings };
}
export async function fetchOfficialLifecyclePage(provider, now = new Date()) {
    const sourceInfo = PROVIDER_SOURCES.find((item) => item.provider === provider);
    if (!sourceInfo)
        throw new Error(`No official source configured for ${provider}.`);
    let url = sourceInfo.lifecycleDocs;
    let response;
    const signal = AbortSignal.timeout(25_000);
    for (let hop = 0; hop <= 5; hop++) {
        const destination = new URL(url);
        if (destination.protocol !== "https:" || !sourceInfo.officialHosts.includes(destination.hostname))
            throw new Error(`${provider} lifecycle redirect is not approved: ${destination.hostname}`);
        response = await fetch(url, {
            headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "ModelDeps/0.4.0" },
            redirect: "manual", signal
        });
        if (![301, 302, 303, 307, 308].includes(response.status))
            break;
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || hop === 5)
            throw new Error("Invalid or excessive source redirects.");
        url = new URL(location, url).toString();
    }
    if (!response)
        throw new Error("No source response.");
    if (!response.ok)
        throw new Error(`${provider} official lifecycle page returned HTTP ${response.status}. Registry was not changed.`);
    const finalUrl = new URL(response.url || url);
    if (finalUrl.protocol !== "https:" || !sourceInfo.officialHosts.includes(finalUrl.hostname)) {
        throw new Error(`${provider} lifecycle page redirected to a non-approved host (${finalUrl.hostname}). Registry was not changed.`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType))
        throw new Error(`${provider} lifecycle page returned unexpected content type: ${contentType || "missing"}.`);
    const html = await boundedText(response, 12_000_000);
    if (html.length > 12_000_000)
        throw new Error(`${provider} lifecycle page exceeds the 12 MB safety limit.`);
    if (!/<table\b/i.test(html))
        throw new Error(`${provider} lifecycle page contains no HTML tables. Registry was not changed.`);
    return parseOfficialLifecyclePage(provider, html, finalUrl.toString(), now.toISOString(), sha256(html));
}
//# sourceMappingURL=live-page.js.map