import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_POLICY, type Policy } from "./types.js";
import { isRecord } from "./util.js";

export interface ModelDepsConfig {
  version: 1;
  providers: string[];
  policy: Policy;
  ignore: string[];
  evaluations: { default?: { command?: string; timeout_seconds?: number } };
}

const DEFAULT_CONFIG: ModelDepsConfig = {
  version: 1,
  providers: ["openai", "anthropic", "google"],
  policy: DEFAULT_POLICY,
  ignore: ["**/node_modules/**", "**/.git/**", "**/.modeldeps/**", "**/dist/**", "**/coverage/**", "**/docs/**"],
  evaluations: {}
};

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null" || trimmed === "~") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const quote = trimmed[0];
    const body = trimmed.slice(1, -1);
    return quote === '"' ? JSON.parse(trimmed) as string : body.replace(/''/g, "'");
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{") || trimmed.includes("&") || trimmed.startsWith("*")) {
    throw new Error(`Unsupported YAML syntax: ${trimmed}`);
  }
  return trimmed;
}

function stripYamlComment(line: string): string {
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if ((char === "'" || char === '"') && (i === 0 || line[i - 1] !== "\\")) {
      if (quote === char) quote = null;
      else if (quote === null) quote = char;
    }
    if (char === "#" && quote === null && (i === 0 || /\s/.test(line[i - 1]!))) return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

/** A deliberately small YAML subset parser: mappings, sequences, and scalar values only. */
export function parseYamlSubset(source: string): unknown {
  const lines = source.split(/\r?\n/).map((raw, index) => {
    const cleaned = stripYamlComment(raw);
    const indent = cleaned.match(/^ */)?.[0].length ?? 0;
    return { raw: cleaned, indent, text: cleaned.trim(), line: index + 1 };
  }).filter((line) => line.text.length > 0 && line.text !== "---" && line.text !== "...");

  if (lines.length === 0) return {};
  if (lines.some((line) => line.raw.includes("\t"))) throw new Error("YAML tabs for indentation are not supported; use spaces.");

  const parseBlock = (start: number, indent: number): { value: unknown; next: number } => {
    const first = lines[start];
    if (!first) return { value: {}, next: start };
    const isSequence = first.indent === indent && first.text.startsWith("- ");
    const container: unknown[] | Record<string, unknown> = isSequence ? [] : {};
    let index = start;

    while (index < lines.length) {
      const current = lines[index]!;
      if (current.indent < indent) break;
      if (current.indent > indent) throw new Error(`Unexpected indentation at YAML line ${current.line}.`);
      if (isSequence) {
        if (!current.text.startsWith("- ")) throw new Error(`Expected a list item at YAML line ${current.line}.`);
        const valueText = current.text.slice(2).trim();
        if (valueText === "") {
          const next = lines[index + 1];
          if (!next || next.indent <= indent) {
            (container as unknown[]).push(null);
            index += 1;
          } else {
            const nested = parseBlock(index + 1, next.indent);
            (container as unknown[]).push(nested.value);
            index = nested.next;
          }
        } else if (/^[^:]+:\s*/.test(valueText)) {
          const colon = valueText.indexOf(":");
          const key = valueText.slice(0, colon).trim();
          const rest = valueText.slice(colon + 1).trim();
          const item: Record<string, unknown> = {};
          if (key.length === 0) throw new Error(`Empty YAML key at line ${current.line}.`);
          if (rest !== "") item[key] = parseScalar(rest);
          else {
            const next = lines[index + 1];
            if (next && next.indent > indent) {
              const nested = parseBlock(index + 1, next.indent);
              item[key] = nested.value;
              index = nested.next - 1;
            } else item[key] = {};
          }
          (container as unknown[]).push(item);
          index += 1;
        } else {
          (container as unknown[]).push(parseScalar(valueText));
          index += 1;
        }
      } else {
        if (current.text.startsWith("- ")) throw new Error(`Unexpected list item at YAML line ${current.line}.`);
        const colon = current.text.indexOf(":");
        if (colon <= 0) throw new Error(`Expected key: value at YAML line ${current.line}.`);
        const key = current.text.slice(0, colon).trim();
        const rest = current.text.slice(colon + 1).trim();
        if (key.length === 0) throw new Error(`Empty YAML key at line ${current.line}.`);
        if (rest !== "") {
          (container as Record<string, unknown>)[key] = parseScalar(rest);
          index += 1;
        } else {
          const next = lines[index + 1];
          if (next && next.indent > indent) {
            const nested = parseBlock(index + 1, next.indent);
            (container as Record<string, unknown>)[key] = nested.value;
            index = nested.next;
          } else {
            (container as Record<string, unknown>)[key] = {};
            index += 1;
          }
        }
      }
    }
    return { value: container, next: index };
  };

  const parsed = parseBlock(0, lines[0]!.indent);
  if (parsed.next < lines.length) throw new Error(`Could not parse YAML from line ${lines[parsed.next]!.line}.`);
  return parsed.value;
}

export function mergeConfig(input: unknown): ModelDepsConfig {
  if (!isRecord(input)) throw new Error("Configuration must be a mapping/object.");
  const policyInput = isRecord(input.policy) ? input.policy : {};
  const evalInput = isRecord(input.evaluations) ? input.evaluations : {};
  const defaultEval = isRecord(evalInput.default) ? evalInput.default : undefined;

  if (input.version !== undefined && input.version !== 1) throw new Error("Configuration version must be 1.");
  const allowedStatuses = new Set(["active", "preview", "deprecated", "retired", "unknown"]);
  if (policyInput.fail_on !== undefined && (!Array.isArray(policyInput.fail_on) || !policyInput.fail_on.every((status) => typeof status === "string" && allowedStatuses.has(status)))) {
    throw new Error("policy.fail_on must be a list of valid lifecycle statuses.");
  }
  if (input.providers !== undefined && (!Array.isArray(input.providers) || !input.providers.every((provider) => typeof provider === "string" && ["openai", "anthropic", "google"].includes(provider)))) {
    throw new Error("providers must be a list containing only openai, anthropic, and/or google.");
  }
  if (input.ignore !== undefined && (!Array.isArray(input.ignore) || !input.ignore.every((pattern) => typeof pattern === "string"))) {
    throw new Error("ignore must be a list of path patterns.");
  }
  if (policyInput.require_eval_on !== undefined && (!Array.isArray(policyInput.require_eval_on) || !policyInput.require_eval_on.every((change) => typeof change === "string" && change.trim() !== ""))) {
    throw new Error("policy.require_eval_on must be a list of non-empty change names.");
  }
  for (const field of ["warn_days_before_shutdown", "fail_days_before_shutdown", "max_source_age_days"]) {
    if (policyInput[field] !== undefined && typeof policyInput[field] !== "number") throw new Error(`policy.${field} must be a number.`);
  }
  if (policyInput.fail_on_unknown !== undefined && typeof policyInput.fail_on_unknown !== "boolean") throw new Error("policy.fail_on_unknown must be boolean.");
  if (defaultEval?.command !== undefined && (typeof defaultEval.command !== "string" || !defaultEval.command.trim())) throw new Error("evaluations.default.command must be a non-empty string.");
  const policy: Policy = {
    fail_on: Array.isArray(policyInput.fail_on) ? policyInput.fail_on as Policy["fail_on"] : DEFAULT_POLICY.fail_on,
    warn_days_before_shutdown: typeof policyInput.warn_days_before_shutdown === "number" ? policyInput.warn_days_before_shutdown : DEFAULT_POLICY.warn_days_before_shutdown,
    fail_days_before_shutdown: typeof policyInput.fail_days_before_shutdown === "number" ? policyInput.fail_days_before_shutdown : DEFAULT_POLICY.fail_days_before_shutdown,
    fail_on_unknown: typeof policyInput.fail_on_unknown === "boolean" ? policyInput.fail_on_unknown : DEFAULT_POLICY.fail_on_unknown,
    require_eval_on: Array.isArray(policyInput.require_eval_on) ? policyInput.require_eval_on.map(String) : DEFAULT_POLICY.require_eval_on,
    max_source_age_days: typeof policyInput.max_source_age_days === "number" ? policyInput.max_source_age_days : DEFAULT_POLICY.max_source_age_days
  };
  if ([policy.warn_days_before_shutdown, policy.fail_days_before_shutdown, policy.max_source_age_days].some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("Shutdown thresholds and max_source_age_days must be non-negative integers.");
  }
  if (defaultEval?.timeout_seconds !== undefined && (typeof defaultEval.timeout_seconds !== "number" || !Number.isInteger(defaultEval.timeout_seconds) || defaultEval.timeout_seconds <= 0)) {
    throw new Error("evaluations.default.timeout_seconds must be a positive integer.");
  }

  return {
    version: 1,
    providers: Array.isArray(input.providers) ? input.providers.map(String) : DEFAULT_CONFIG.providers,
    policy,
    ignore: Array.isArray(input.ignore) ? input.ignore.map(String) : DEFAULT_CONFIG.ignore,
    evaluations: defaultEval ? {
      default: {
        ...(typeof defaultEval.command === "string" ? { command: defaultEval.command } : {}),
        ...(typeof defaultEval.timeout_seconds === "number" ? { timeout_seconds: defaultEval.timeout_seconds } : {})
      }
    } : {}
  };
}

export async function loadConfig(root: string, explicitPath?: string): Promise<ModelDepsConfig> {
  const candidates = explicitPath ? [path.resolve(explicitPath)] : [
    path.join(root, ".modeldeps.yml"),
    path.join(root, ".modeldeps.yaml"),
    path.join(root, ".modeldeps.json")
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
    } catch {
      if (explicitPath) throw new Error(`Cannot read explicit config: ${candidate}`);
      continue;
    }
    const text = await readFile(candidate, "utf8");
    let parsed: unknown;
    if (candidate.endsWith(".json")) {
      try { parsed = JSON.parse(text) as unknown; }
      catch (error) { throw new Error(`Invalid JSON config ${candidate}: ${error instanceof Error ? error.message : String(error)}`); }
    } else {
      parsed = parseYamlSubset(text);
    }
    return mergeConfig(parsed);
  }
  return DEFAULT_CONFIG;
}
