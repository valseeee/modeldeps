import { boundedText } from "./http.js";
import type { ModelRecord, Provider, RegistrySnapshot, Replacement } from "../types.js";
import { validateRegistry } from "../registry.js";
import { isIsoDate, sha256 } from "../util.js";
import { PROVIDER_SOURCES } from "./catalog.js";

export interface LivePageResult {
  generated_at: string;
  models: ModelRecord[];
  source_url: string;
  final_url: string;
  source_sha256: string;
  warnings: string[];
}

interface HtmlTable { headers: string[]; rows: Array<{ cells: string[]; previewSection: boolean }>; heading: string; }

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([\da-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function cellText(html: string): string {
  return decodeEntities(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ").trim());
}

function parseTables(html: string): HtmlTable[] {
  const beforeTableHeadings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)];
  const tables: HtmlTable[] = [];
  for (const tableMatch of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableIndex = tableMatch.index ?? 0;
    const headingMatch = [...beforeTableHeadings].reverse().find((heading) => (heading.index ?? 0) < tableIndex);
    const tableHtml = tableMatch[1] ?? "";
    const rawRows = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) =>
      [...(row[1] ?? "").matchAll(/<t[hd]\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi)]
    ).filter((row) => row.length > 0);
    if (rawRows.length < 2) continue;
    const headers = rawRows[0]!.map((cell) => cellText(cell[2] ?? "").toLowerCase());
    const rows = rawRows.slice(1).map((row) => {
      const cells = row.map((cell) => cellText(cell[2] ?? ""));
      const span = (row[0]?.[1] ?? "").match(/\bcolspan\s*=\s*(?:"(\d+)"|'(\d+)'|(\d+))(?=\s|$)/i);
      const previewSection = cells.length === 1 && /^preview models$/i.test(cells[0] ?? "") && Number(span?.[1] ?? span?.[2] ?? span?.[3]) === headers.length;
      return { cells, previewSection };
    });
    tables.push({ headers, rows, heading: headingMatch ? cellText(headingMatch[1] ?? "") : "" });
  }
  return tables;
}

function column(headers: string[], patterns: RegExp[]): number {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
}

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12"
};

function parseDate(text: string): string | undefined {
  const value = text.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return isIsoDate(value) ? value.slice(0, 10) : undefined;
  const match = value.match(/(?:not sooner than\s+|tentative(?: retirement)? date[:\s]*)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (!match) return undefined;
  const month = MONTHS[match[1]!.toLowerCase()];
  if (!month) return undefined;
  const result = `${match[3]}-${month}-${match[2]!.padStart(2, "0")}`;
  return isIsoDate(result) ? result : undefined;
}

function statusFromText(text: string): ModelRecord["status"] {
  const value = text.toLowerCase().trim();
  if (value === "retired" || value.includes("already retired")) return "retired";
  if (value === "deprecated") return "deprecated";
  if (value === "active") return "active";
  if (value === "preview") return "preview";
  // Do not silently equate provider-specific "legacy" semantics with deprecated.
  return "unknown";
}

function modelId(value: string): string | undefined {
  const text = value.trim().replace(/^`|`$/g, "");
  if (!text || /^(?:n\/a|none|not available|no shutdown date announced|to be announced)$/i.test(text)) return undefined;
  // Some official tables append explanatory parentheticals after the canonical model ID.
  // Accept only a model-like first token (must contain a separator), never a guessed display name.
  const match = text.match(/^([A-Za-z0-9][A-Za-z0-9._:-]*)/);
  const candidate = match?.[1];
  if (!candidate || !/[-._:]/.test(candidate)) return undefined;
  return candidate;
}

function replacements(value: string, provider: Exclude<Provider, "unknown">, surface: string): Replacement[] {
  const ids = value.split("(", 1)[0]!.split(/\s+or\s+/i).map(modelId).filter((id): id is string => Boolean(id));
  return [...new Set(ids)].map((id) => ({ model_id: id, provider, surface, authority: "provider" }));
}

export function parseOfficialLifecyclePage(
  provider: "anthropic" | "google",
  html: string,
  sourceUrl: string,
  observedAt = new Date().toISOString(),
  rawHash = sha256(html)
): LivePageResult {
  const sourceInfo = PROVIDER_SOURCES.find((item) => item.provider === provider);
  if (!sourceInfo) throw new Error(`No official source configured for ${provider}.`);
  const parsedUrl = new URL(sourceUrl);
  if (parsedUrl.protocol !== "https:" || !sourceInfo.officialHosts.includes(parsedUrl.hostname)) {
    throw new Error(`Live source URL must use an official ${provider} host.`);
  }
  const tables = parseTables(html);
  const models = new Map<string, ModelRecord>();
  const warnings: string[] = [];
  const source = {
    kind: "official" as const,
    evidence_mode: "live-page" as const,
    parser_version: "0.4.0.3",
    url: sourceUrl,
    observed_at: observedAt,
    sha256: rawHash
  };

  for (const table of tables) {
    const modelCol = column(table.headers, provider === "anthropic" ? [/api model name/, /model name/] : [/^model$/, /model name/]);
    if (modelCol < 0) continue;
    const statusCol = provider === "anthropic" ? column(table.headers, [/current state/, /^status$/]) : -1;
    const deprecatedCol = provider === "anthropic" ? column(table.headers, [/^deprecated$/]) : -1;
    const shutdownCol = column(table.headers, provider === "anthropic" ? [/tentative retirement date/, /retirement date/, /shutdown date/] : [/shutdown date/]);
    const replacementCol = column(table.headers, [/recommended replacement/]);
    const hasLifecycleColumns = statusCol >= 0 || shutdownCol >= 0;
    if (!hasLifecycleColumns) continue;

    const tableModels = new Set<string>();
    let previewSection = false;
    for (const parsedRow of table.rows) {
      if (provider === "google" && parsedRow.previewSection) { previewSection = true; continue; }
      const row = parsedRow.cells;
      const id = modelId(row[modelCol] ?? "");
      if (!id) throw new Error(`Lifecycle table contains a row without a canonical model ID: ${JSON.stringify((row[modelCol] ?? "").slice(0, 120))}`);
      if (row.length !== table.headers.length) throw new Error("Lifecycle table structure changed: missing cells.");
      if (models.size >= 2000) throw new Error("Lifecycle row count exceeds safety limit.");
      const dateText = shutdownCol >= 0 ? (row[shutdownCol] ?? "") : "";
      const shutdownAt = parseDate(dateText);
      if (dateText && !shutdownAt && !/^(?:n\/a|none|no shutdown date announced|to be announced|-)$/i.test(dateText.trim())) throw new Error(`Unrecognized shutdown date for ${id}: ${dateText}`);
      if (tableModels.has(id)) throw new Error(`Duplicate model row: ${id}`);
      tableModels.add(id);
      const statusText = statusCol >= 0 ? (row[statusCol] ?? "") : "";
      let status = statusCol >= 0 ? statusFromText(statusText) : (shutdownAt ? "deprecated" : (previewSection || /preview/i.test(table.heading) || /preview/i.test(id) ? "preview" : "active"));
      if (provider === "google" && shutdownAt) status = "deprecated"; // Google dates are earliest-possible, never proof of shutdown.
      const dateKind = shutdownAt ? (provider === "google" ? "earliest-possible" as const : (/not sooner than|tentative/i.test(dateText) || /tentative retirement date/.test(table.headers[shutdownCol] ?? "") ? "tentative" as const : "confirmed" as const)) : undefined;
      const announcedAt = deprecatedCol >= 0 ? parseDate(row[deprecatedCol] ?? "") : undefined;
      const replacementList = replacementCol >= 0 ? replacements(row[replacementCol] ?? "", provider, sourceInfo.surface) : [];
      const record: ModelRecord = {
        provider,
        surface: sourceInfo.surface,
        model_id: id,
        status,
        recommended_replacements: replacementList,
        source,
        ...(announcedAt ? { announced_at: announcedAt } : {}),
        ...(shutdownAt ? { shutdown_at: shutdownAt, shutdown_date_kind: dateKind! } : {}),
        ...(statusText.toLowerCase() === "legacy" ? { notes: "Provider labels this model legacy; ModelDeps preserves that distinction as status=unknown rather than guessing equivalence." } : {}),
        ...(provider === "google" && shutdownAt ? { notes: "Google documents this as the earliest possible shutdown date. A past date alone does not prove the endpoint is already disabled." } : {})
      };
      const existing = models.get(id);
      if (existing) {
        if (provider !== "google" || JSON.stringify(existing) !== JSON.stringify(record)) throw new Error(`Duplicate model row with conflicting lifecycle facts: ${id}`);
        warnings.push(`Identical ${id} lifecycle facts repeated across separate official tables were consolidated.`);
      } else models.set(id, record);
    }
  }

  // Anthropic also documents replacements in a separate deprecation-history table.
  // Enrich only model IDs already found in an explicit lifecycle table; never create an ungrounded model.
  if (provider === "anthropic") {
    for (const table of tables) {
      const deprecatedModelCol = column(table.headers, [/deprecated model/]);
      const replacementCol = column(table.headers, [/recommended replacement/]);
      if (deprecatedModelCol < 0 || replacementCol < 0) continue;
      for (const { cells: row } of table.rows) {
        const id = modelId(row[deprecatedModelCol] ?? "");
        const replacement = replacements(row[replacementCol] ?? "", provider, sourceInfo.surface);
        if (!id || replacement.length === 0) continue;
        const existing = models.get(id);
        if (existing) models.set(id, { ...existing, recommended_replacements: replacement, replacement_source: source });
      }
    }
  }

  const minimum = provider === "anthropic" ? 5 : 5;
  if (models.size < minimum) {
    throw new Error(`Official ${provider} page parser found only ${models.size} model rows (minimum ${minimum}). Refusing to update registry; page markup may have changed.`);
  }
  const snapshot: Pick<RegistrySnapshot, "generated_at" | "models"> = {
    generated_at: observedAt,
    models: [...models.values()].sort((a, b) => a.model_id.localeCompare(b.model_id))
  };
  validateRegistry({ schema_version: "0.1", ...snapshot });
  return { ...snapshot, source_url: sourceUrl, final_url: sourceUrl, source_sha256: rawHash, warnings };
}

export async function fetchOfficialLifecyclePage(provider: "anthropic" | "google", now = new Date()): Promise<LivePageResult> {
  const sourceInfo = PROVIDER_SOURCES.find((item) => item.provider === provider);
  if (!sourceInfo) throw new Error(`No official source configured for ${provider}.`);
  let url = sourceInfo.lifecycleDocs;
  let response: Response | undefined;
  const signal = AbortSignal.timeout(25_000);
  for (let hop = 0; hop <= 5; hop++) {
    const destination = new URL(url);
    if (destination.protocol !== "https:" || !sourceInfo.officialHosts.includes(destination.hostname)) throw new Error(`${provider} lifecycle redirect is not approved: ${destination.hostname}`);
    response = await fetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "ModelDeps/0.4.1" },
      redirect: "manual", signal
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location || hop === 5) throw new Error("Invalid or excessive source redirects.");
    url = new URL(location, url).toString();
  }
  if (!response) throw new Error("No source response.");
  if (!response.ok) throw new Error(`${provider} official lifecycle page returned HTTP ${response.status}. Registry was not changed.`);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.protocol !== "https:" || !sourceInfo.officialHosts.includes(finalUrl.hostname)) {
    throw new Error(`${provider} lifecycle page redirected to a non-approved host (${finalUrl.hostname}). Registry was not changed.`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) throw new Error(`${provider} lifecycle page returned unexpected content type: ${contentType || "missing"}.`);
  const html = await boundedText(response, 12_000_000);
  if (html.length > 12_000_000) throw new Error(`${provider} lifecycle page exceeds the 12 MB safety limit.`);
  if (!/<table\b/i.test(html)) throw new Error(`${provider} lifecycle page contains no HTML tables. Registry was not changed.`);
  return parseOfficialLifecyclePage(provider, html, finalUrl.toString(), now.toISOString(), sha256(html));
}
