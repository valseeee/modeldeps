import path from "node:path";
import { transactionalWrite } from "./transaction.js";
import { DEFAULT_POLICY, type MigrationPlan, type MigrationPlanItem, type ModelFinding, type ModelRecord, type Policy, type RegistrySnapshot, type RiskLevel } from "./types.js";
import { resolveModel } from "./registry.js";
import { errorMessage, resolveSafeRepositoryFile, sha256 } from "./util.js";

const RISK_ORDER: RiskLevel[] = ["R0", "R1", "R2", "R3", "R4", "R5"];

function riskFor(_record: ModelRecord, replacement: ModelRecord["recommended_replacements"][number]): RiskLevel {
  // A similar model ID is not compatibility evidence. Only an explicit, reviewed
  // registry risk may lower the default behavioral risk.
  return replacement.risk ?? "R3";
}

function migrationItem(record: ModelRecord, replacement: ModelRecord["recommended_replacements"][number], occurrences: ModelFinding[], registry: RegistrySnapshot, policy: Policy): MigrationPlanItem {
  const targetProvider = replacement.provider ?? record.provider;
  const targetSurface = replacement.surface ?? record.surface;
  const target = registry.models.find((model) => model.provider === targetProvider && model.surface === targetSurface && model.model_id === replacement.model_id);
  const risk = riskFor(record, replacement);
  const changes = replacement.changes ?? (risk === "R0" ? [] : risk === "R1" ? ["model_alias_change"] : ["behavioral_compatibility_unknown"]);
  const requiresEval = RISK_ORDER.indexOf(risk) >= RISK_ORDER.indexOf("R2")
    || changes.some((change) => policy.require_eval_on.includes(change));
  const required_gates = requiresEval ? ["configured-eval"] : [];
  const replacementSource = record.replacement_source ?? record.source;
  const autofixable = occurrences.every(finding => finding.resolution === "registry-exact" && finding.confidence >= 0.95)
    && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(replacement.model_id)
    && !requiresEval && replacement.authority === "provider"
    && replacementSource.kind === "official"
    && replacementSource.url?.startsWith("https://") === true
    && record.source.kind === "official"
    && target?.source.kind === "official"
    && target.status === "active"
    && RISK_ORDER.indexOf(risk) <= RISK_ORDER.indexOf("R1")
    && target.provider === targetProvider
    && target.surface === targetSurface
    && targetProvider === record.provider
    && targetSurface === record.surface
    && record.recommended_replacements.length === 1;

  return {
    from: { provider: record.provider, surface: record.surface, model_id: record.model_id },
    to: { provider: targetProvider, surface: targetSurface, model_id: replacement.model_id },
    authority: replacement.authority,
    risk,
    changes,
    required_gates,
    autofixable,
    occurrences: occurrences.map(({ file, line, column }) => ({ file, line, column })),
    source: replacementSource,
    lifecycle_source: record.source
  };
}

export function planMigrations(findings: ModelFinding[], registry: RegistrySnapshot, root: string, now = new Date(), policy: Policy = DEFAULT_POLICY): MigrationPlan {
  const grouped = new Map<string, { record: ModelRecord; findings: ModelFinding[] }>();
  for (const finding of findings) {
    const record = resolveModel(registry, finding.provider, finding.surface, finding.model_id);
    if (!record || record.recommended_replacements.length === 0) continue;
    const key = `${record.provider}\0${record.surface}\0${record.model_id}`;
    const existing = grouped.get(key);
    if (existing) existing.findings.push(finding);
    else grouped.set(key, { record, findings: [finding] });
  }

  const migrations: MigrationPlanItem[] = [];
  for (const { record, findings: occurrences } of grouped.values()) {
    for (const replacement of record.recommended_replacements) {
      migrations.push(migrationItem(record, replacement, occurrences, registry, policy));
    }
  }
  migrations.sort((a, b) => a.from.provider.localeCompare(b.from.provider) || a.from.model_id.localeCompare(b.from.model_id));
  const notes = [
    "A provider-declared replacement is a migration candidate, not proof of behavioral compatibility.",
    "R2 or higher migrations require a configured evaluation command before they can pass the migration gate.",
    "A provider-declared replacement is not a compatibility guarantee; absent an explicit reviewed risk, migrations default to R3.",
    "Automatic edits are disabled unless the source and target records are official, same-surface, and explicitly reviewed as R0 or R1."
  ];
  return {
    schema_version: "0.2",
    generated_at: now.toISOString(),
    root: path.resolve(root),
    registry_sha256: sha256(JSON.stringify(registry)),
    repository_inputs: [],
    migrations,
    notes
  };
}

export interface ApplyResult {
  applied: boolean;
  changed_files: string[];
  blocked: string[];
  dry_run: boolean;
}

export async function applyMigrationPlan(plan: MigrationPlan, rootInput: string, write: boolean, registry: RegistrySnapshot): Promise<ApplyResult> {
  const fs = await import("node:fs/promises");
  const root = path.resolve(rootInput);
  const blocked: string[] = [];
  const byFile = new Map<string, Array<{ line: number; column: number; from: string; to: string }>>();

  for (const migration of plan.migrations) {
    const sourceRecord = resolveModel(registry, migration.from.provider, migration.from.surface, migration.from.model_id);
    const targetRecord = resolveModel(registry, migration.to.provider, migration.to.surface, migration.to.model_id);
    const declaredReplacement = sourceRecord?.recommended_replacements.find((item) => item.model_id === migration.to.model_id);
    const verifiedEligible = Boolean(
      /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(migration.to.model_id)
      && sourceRecord && targetRecord && declaredReplacement
      && sourceRecord.source.kind === "official" && sourceRecord.source.url?.startsWith("https://")
      && (sourceRecord.replacement_source ?? sourceRecord.source).kind === "official"
      && (sourceRecord.replacement_source ?? sourceRecord.source).url?.startsWith("https://")
      && targetRecord.source.kind === "official" && targetRecord.source.url?.startsWith("https://")
      && targetRecord.status === "active"
      && declaredReplacement.authority === "provider"
      && (declaredReplacement.risk === "R0" || declaredReplacement.risk === "R1")
      && migration.risk === declaredReplacement.risk
      && migration.from.provider === migration.to.provider
      && migration.from.surface === migration.to.surface
      && sourceRecord.recommended_replacements.length === 1
    );
    if (migration.required_gates.length > 0 || !migration.autofixable || !verifiedEligible) {
      blocked.push(`${migration.from.model_id} → ${migration.to.model_id}: registry evidence does not satisfy the automatic-edit policy (risk ${migration.risk}).`);
      continue;
    }
    for (const occurrence of migration.occurrences) {
      const list = byFile.get(occurrence.file) ?? [];
      list.push({ line: occurrence.line, column: occurrence.column, from: migration.from.model_id, to: migration.to.model_id });
      byFile.set(occurrence.file, list);
    }
  }

  // Prepare and validate every edit before writing any file. This prevents a partially
  // applied plan when one of its occurrences is stale or escapes the repository root.
  const proposed = new Map<string, string>();
  const originals = new Map<string, Buffer>();
  for (const [relativeFile, edits] of byFile) {
    let absolute: string;
    try {
      absolute = await resolveSafeRepositoryFile(root, relativeFile);
    } catch (error) {
      blocked.push(`${relativeFile}: ${errorMessage(error)}`);
      continue;
    }
    const bytes = await fs.readFile(absolute);
    let original: string;
    try { original = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { blocked.push(`${relativeFile}: only valid UTF-8 input can be patched.`); continue; }
    if (original.includes("\0")) { blocked.push(`${relativeFile}: binary or UTF-16 input cannot be patched.`); continue; }
    if (((await fs.stat(absolute)).mode & 0o222) === 0) { blocked.push(`${relativeFile}: read-only file.`); continue; }
    originals.set(relativeFile, bytes);
    const lines = original.split(/(?<=\n)/);
    const grouped = new Map<number, typeof edits>();
    for (const edit of edits) {
      const list = grouped.get(edit.line) ?? [];
      list.push(edit);
      grouped.set(edit.line, list);
    }
    let fileChanged = false;
    for (const [lineNumber, lineEdits] of grouped) {
      const lineIndex = lineNumber - 1;
      if (lineIndex < 0 || lineIndex >= lines.length) {
        blocked.push(`${relativeFile}:${lineNumber}: line no longer exists; regenerate the plan.`);
        continue;
      }
      let line = lines[lineIndex]!;
      for (const edit of [...lineEdits].sort((a, b) => b.column - a.column)) {
        const start = edit.column - 1;
        if (line.slice(start, start + edit.from.length) !== edit.from) {
          blocked.push(`${relativeFile}:${lineNumber}:${edit.column}: source text changed; regenerate the plan.`);
          continue;
        }
        line = `${line.slice(0, start)}${edit.to}${line.slice(start + edit.from.length)}`;
        fileChanged = true;
      }
      lines[lineIndex] = line;
    }
    if (fileChanged) proposed.set(relativeFile, lines.join(""));
  }

  if (write && blocked.length > 0) {
    return { applied: false, changed_files: [], blocked, dry_run: false };
  }
  if (write) {
    const changes = [];
    for (const [relativeFile, content] of proposed) {
      const absolute = await resolveSafeRepositoryFile(root, relativeFile);
      if (!(await fs.readFile(absolute)).equals(originals.get(relativeFile)!)) {
        return { applied: false, changed_files: [], blocked: [`${relativeFile}: input changed before writing`], dry_run: false };
      }
      changes.push({ file: absolute, original: originals.get(relativeFile)!, content });
    }
    try { await transactionalWrite(changes); }
    catch (error) { return { applied: false, changed_files: [], blocked: [errorMessage(error)], dry_run: false }; }
  }
  return {
    applied: write && proposed.size > 0 && blocked.length === 0,
    changed_files: [...proposed.keys()].sort(),
    blocked,
    dry_run: !write
  };
}
