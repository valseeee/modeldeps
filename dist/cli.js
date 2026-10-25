#!/usr/bin/env node
import { snapshotWorkspace } from "./workspace.js";
import { SourceError } from "./providers/http.js";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { verifyPlan } from "./eval-gate.js";
import { renderCheckText, renderEvidenceMarkdown, renderGitHubSummary, renderMigrationPlanMarkdown, renderScanText, toSarif } from "./formats.js";
import { checkExitCode, checkModels } from "./policy.js";
import { applyMigrationPlan, planMigrations } from "./planner.js";
import { fetchOpenAILifecycle } from "./providers/openai.js";
import { fetchOfficialLifecyclePage } from "./providers/live-page.js";
import { importReviewedSnapshot } from "./providers/reviewed-snapshot.js";
import { PROVIDER_SOURCES } from "./providers/catalog.js";
import { loadRegistry, validateRegistry, writeRegistry } from "./registry.js";
import { scanRepository } from "./scanner.js";
import { errorMessage, isRecord, resolveSafeRepositoryFile, sha256 } from "./util.js";
function parseArgs(args) {
    const positionals = [];
    const options = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg.startsWith("--")) {
            positionals.push(arg);
            continue;
        }
        const equalAt = arg.indexOf("=");
        if (equalAt >= 0) {
            options.set(arg.slice(2, equalAt), arg.slice(equalAt + 1));
            continue;
        }
        const key = arg.slice(2);
        const next = args[index + 1];
        if (next !== undefined && !next.startsWith("--")) {
            options.set(key, next);
            index += 1;
        }
        else {
            options.set(key, true);
        }
    }
    return { positionals, options };
}
function option(args, name) {
    const value = args.options.get(name);
    return typeof value === "string" ? value : undefined;
}
function hasFlag(args, name) {
    return args.options.get(name) === true || args.options.get(name) === "true";
}
function help() {
    return `ModelDeps — local-first AI model lifecycle checks and migration gates

Usage:
  modeldeps scan <path> [--registry <file>] [--config <file>] [--format text|json]
  modeldeps check <path> [--registry <file>] [--config <file>] [--format text|json|sarif] [--fail-in <days>] [--strict-unknown] [--strict-stale]
  modeldeps plan <path> [--registry <file>] [--config <file>] [--format json|markdown] [--output <file>]
  modeldeps verify --plan <file> [--command <shell command>] [--root <path>] [--timeout <seconds>] [--format text|json|markdown] [--output <file>]
  modeldeps apply --plan <file> --registry <file> [--root <path>] [--write]
  modeldeps registry validate [--registry <file>]
  modeldeps registry info [--registry <file>]
  modeldeps registry sync --provider openai [--input <reviewed-snapshot.json>] [--registry <file>] [--output <file>]
  modeldeps registry sync --provider anthropic|google --live [--registry <file>] [--output <file>]
  modeldeps registry sync --provider anthropic|google --input <reviewed-snapshot.json> [--registry <file>] [--output <file>]
  modeldeps benchmark [--cases <jsonl>] [--format text|json]
  modeldeps benchmark-repos [--manifest <json>] [--clone] [--output <report.json>] [--write-template <gold.json>]

Examples:
  modeldeps check .
  modeldeps check ./src --registry ./registry.json --format sarif
  modeldeps plan . --output .modeldeps/plan.json
  modeldeps verify --plan .modeldeps/plan.json --command "npm run eval:model-migration"
  modeldeps registry sync --provider openai --registry ./registry.json --output ./registry.json

Exit codes: 0 = policy passed, 1 = policy/evaluation blocked, 2 = usage/configuration/internal error, 3 = network/source failure.
Normal scan/check/plan commands do not require provider API keys. Registry sync for OpenAI uses OPENAI_API_KEY.
Anthropic/Gemini --live adapters are experimental; they fail closed on unexpected source structure. Use --input for a reviewed snapshot. Sync is additive and --prune-missing is disabled. Plan/evidence output writes a .sha256 sidecar; registry records retain source/snapshot provenance hashes.
`;
}
function bundledRegistryPath() {
    return fileURLToPath(new URL("../data/registry.json", import.meta.url));
}
async function registryFor(args) {
    return loadRegistry(option(args, "registry"));
}
async function hashPlanInputs(rootInput, relativePaths) {
    const root = path.resolve(rootInput);
    const results = [];
    for (const relativePath of [...new Set(relativePaths)].sort()) {
        const portablePath = relativePath.split(path.sep).join("/");
        const absolute = await resolveSafeRepositoryFile(root, portablePath);
        results.push({ path: portablePath, sha256: sha256(await readFile(absolute)) });
    }
    return results;
}
async function comparePlanInputs(plan, rootInput) {
    const root = path.resolve(rootInput);
    const current = [];
    const mismatches = [];
    for (const expected of plan.repository_inputs ?? []) {
        let absolute;
        try {
            absolute = await resolveSafeRepositoryFile(root, expected.path);
        }
        catch (error) {
            mismatches.push(`${expected.path}: ${errorMessage(error)}`);
            continue;
        }
        const actual = sha256(await readFile(absolute));
        current.push({ path: expected.path, sha256: actual, expected_sha256: expected.sha256 });
        if (actual !== expected.sha256)
            mismatches.push(`${expected.path}: SHA-256 changed since plan generation`);
    }
    return { current, mismatches };
}
function migrationFingerprint(plan) {
    const items = plan.migrations.map((migration) => ({
        from: migration.from,
        to: migration.to,
        authority: migration.authority,
        risk: migration.risk,
        changes: migration.changes,
        required_gates: migration.required_gates,
        autofixable: migration.autofixable,
        occurrences: migration.occurrences,
        source: migration.source,
        lifecycle_source: migration.lifecycle_source
    }));
    items.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify(items);
}
/** Recompute migration policy from current repository content and registry. A plan is data, not trusted policy. */
async function validatePlanAgainstCurrentState(plan, root, registry, config, planFile) {
    try {
        const readHash = readPlanHashes.get(plan);
        if (readHash !== sha256(await readFile(planFile)))
            return "Plan bytes changed during validation.";
        try {
            const sidecar = await readFile(`${planFile}.sha256`, "utf8");
            if (sidecar.split(/\s+/)[0] !== readHash)
                return "Plan SHA-256 does not match its generated artifact; regenerate plan.";
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
        }
        if (path.resolve(plan.root) !== path.resolve(root))
            return "Repository root identity differs from plan; regenerate plan for this checkout.";
        if (plan.schema_version !== "0.2")
            return "Unsupported legacy migration plan schema; regenerate the plan with this version.";
        if (typeof plan.registry_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(plan.registry_sha256)) {
            return "Migration plan is missing a valid registry hash; regenerate the plan.";
        }
        if (!Array.isArray(plan.repository_inputs))
            return "Migration plan is missing its repository input manifest; regenerate the plan.";
        if (!plan.repository_inputs.every((item) => isRecord(item) && typeof item.path === "string" && typeof item.sha256 === "string" && /^[a-f0-9]{64}$/.test(item.sha256))) {
            return "Migration plan contains an invalid repository input manifest; regenerate the plan.";
        }
        const expectedPaths = [...new Set(plan.migrations.flatMap((migration) => migration.occurrences.map((occurrence) => occurrence.file)))].sort();
        const manifestPaths = plan.repository_inputs.map((item) => item.path).sort();
        if (JSON.stringify(expectedPaths) !== JSON.stringify(manifestPaths)) {
            return "Migration plan repository input manifest does not match its occurrences; regenerate the plan.";
        }
        const futureLimit = Date.now() + 300_000;
        if (Date.parse(registry.generated_at) > futureLimit || registry.models.some(record => Date.parse(record.source.observed_at) > futureLimit || (record.replacement_source && Date.parse(record.replacement_source.observed_at) > futureLimit))) {
            return "Registry evidence has a future observation timestamp; source freshness cannot be verified.";
        }
        if (checkModels([], registry, config.policy, root).registry.stale)
            return "Registry evidence is stale or empty; refresh it before migration verification or application.";
        if (!Array.isArray(plan.workspace_inputs) || !Array.isArray(plan.excluded_artifacts))
            return "Missing workspace input evidence; regenerate plan.";
        const evaluationIntent = { command: config.evaluations.default?.command ?? null, timeout_seconds: config.evaluations.default?.timeout_seconds ?? 600, execution_status: "pending" };
        if (JSON.stringify(plan.evaluation) !== JSON.stringify(evaluationIntent))
            return "Configured evaluation intent differs from plan; regenerate it.";
        if (plan.config_sha256 !== sha256(JSON.stringify(config)))
            return "Evaluation configuration changed; regenerate plan.";
        const allowedExclusions = [path.relative(root, planFile).split(path.sep).join("/")];
        if (JSON.stringify(plan.excluded_artifacts) !== JSON.stringify(allowedExclusions))
            return "Plan artifact exclusions were edited; regenerate plan.";
        const currentWorkspace = await snapshotWorkspace(root, plan.excluded_artifacts);
        if (JSON.stringify(currentWorkspace) !== JSON.stringify(plan.workspace_inputs))
            return "Workspace inputs changed; regenerate plan.";
        const findings = await scanRepository(root, registry, { ignore: config.ignore, providers: config.providers });
        const regenerated = planMigrations(findings, registry, root, new Date(), config.policy);
        if (migrationFingerprint(plan) !== migrationFingerprint(regenerated)) {
            return "Migration plan does not match the current repository and registry-derived policy. It may have been edited; regenerate the plan.";
        }
        for (const migration of plan.migrations) {
            if (migration.authority !== "provider")
                return "Community migration candidates require manual review; no official replacement evidence.";
            const target = registry.models.find(record => record.provider === migration.to.provider && record.surface === migration.to.surface && record.model_id === migration.to.model_id);
            if (!target || target.status !== "active")
                return "Target model lacks a current active lifecycle record; review it before verification.";
            for (const source of [migration.source, migration.lifecycle_source, target.source]) {
                if (source.kind !== "official" && source.kind !== "fixture")
                    return "Migration lacks official source evidence; manual review required.";
                if (source.kind === "official" && !source.sha256 && !source.snapshot_sha256)
                    return "Official migration source is missing its content or reviewed snapshot hash.";
            }
        }
        return undefined;
    }
    catch (error) {
        return `Could not validate migration plan against current state: ${errorMessage(error)}`;
    }
}
async function writeArtifact(content, outputPath) {
    const absolute = path.resolve(outputPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content.endsWith("\n") ? content : `${content}\n`, "utf8");
    const digest = sha256(await readFile(absolute));
    await writeFile(`${absolute}.sha256`, `${digest}  ${path.basename(absolute)}\n`, "utf8");
    process.stdout.write(`Wrote ${absolute}\nSHA-256 ${digest}\n`);
}
async function emit(content, outputPath) {
    if (!outputPath) {
        process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
        return;
    }
    const absolute = path.resolve(outputPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content.endsWith("\n") ? content : `${content}\n`, "utf8");
    process.stdout.write(`Wrote ${absolute}\n`);
}
async function writeSummaryIfGitHub(result) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath)
        await appendFile(summaryPath, `${renderGitHubSummary(result)}\n`, "utf8");
}
async function runScan(command, args) {
    const root = path.resolve(args.positionals[0] ?? ".");
    const registry = await registryFor(args);
    const config = await loadConfig(root, option(args, "config"));
    const findings = await scanRepository(root, registry, { ignore: config.ignore, providers: config.providers });
    if (command === "scan") {
        const format = option(args, "format") ?? "text";
        if (format === "json")
            await emit(JSON.stringify({ schema_version: "0.2", root, findings }, null, 2), option(args, "output"));
        else if (format === "text")
            await emit(renderScanText(findings), option(args, "output"));
        else
            throw new Error(`Unsupported scan format: ${format}`);
        return 0;
    }
    const policy = { ...config.policy };
    const failIn = option(args, "fail-in");
    if (failIn !== undefined) {
        const days = Number(failIn);
        if (!Number.isInteger(days) || days < 0)
            throw new Error("--fail-in must be a non-negative integer.");
        policy.fail_days_before_shutdown = days;
    }
    if (hasFlag(args, "strict-unknown"))
        policy.fail_on_unknown = true;
    const result = checkModels(findings, registry, policy, root);
    await writeSummaryIfGitHub(result);
    const format = option(args, "format") ?? "text";
    if (format === "json")
        await emit(JSON.stringify(result, null, 2), option(args, "output"));
    else if (format === "sarif")
        await emit(JSON.stringify(toSarif(result), null, 2), option(args, "output"));
    else if (format === "text")
        await emit(renderCheckText(result), option(args, "output"));
    else
        throw new Error(`Unsupported check format: ${format}`);
    if (hasFlag(args, "strict-stale") && result.registry.stale) {
        process.stderr.write(`Policy failure: registry or lifecycle evidence is stale (limit ${policy.max_source_age_days} days). Refresh the registry or omit --strict-stale to accept the warning.\n`);
        return 1;
    }
    return checkExitCode(result);
}
async function runPlan(args) {
    const root = path.resolve(args.positionals[0] ?? ".");
    const registry = await registryFor(args);
    const config = await loadConfig(root, option(args, "config"));
    const findings = await scanRepository(root, registry, { ignore: config.ignore, providers: config.providers });
    const plan = planMigrations(findings, registry, root, new Date(), config.policy);
    plan.repository_inputs = await hashPlanInputs(root, plan.migrations.flatMap((migration) => migration.occurrences.map((occurrence) => occurrence.file)));
    const outputFile = option(args, "output");
    plan.excluded_artifacts = outputFile ? [path.relative(root, path.resolve(outputFile)).split(path.sep).join("/")] : [];
    plan.workspace_inputs = await snapshotWorkspace(root, plan.excluded_artifacts);
    plan.config_sha256 = sha256(JSON.stringify(config));
    plan.evaluation = { command: config.evaluations.default?.command ?? null, timeout_seconds: config.evaluations.default?.timeout_seconds ?? 600, execution_status: "pending" };
    const format = option(args, "format") ?? "json";
    const outputPath = option(args, "output");
    let content;
    if (format === "json")
        content = `${JSON.stringify(plan, null, 2)}\n`;
    else if (format === "markdown")
        content = renderMigrationPlanMarkdown(plan);
    else
        throw new Error(`Unsupported plan format: ${format}`);
    if (outputPath)
        await writeArtifact(content, outputPath);
    else
        await emit(content);
    process.stdout.write(`Migration candidates: ${plan.migrations.length}\n`);
    for (const migration of plan.migrations) {
        process.stdout.write(`  ${migration.from.model_id} → ${migration.to.model_id} | ${migration.risk} | ${migration.required_gates.length ? "eval required" : "no eval gate"} | ${migration.autofixable ? "autofix eligible" : "manual review"}\n`);
    }
    return 0;
}
const readPlanHashes = new WeakMap();
async function readPlan(filePath) {
    const bytes = await readFile(filePath);
    const plan = JSON.parse(bytes.toString("utf8"));
    if (!isRecord(plan) || (plan.schema_version !== "0.1" && plan.schema_version !== "0.2") || !Array.isArray(plan.migrations) || typeof plan.root !== "string") {
        throw new Error(`Invalid migration plan: ${filePath}`);
    }
    const result = plan;
    readPlanHashes.set(result, sha256(bytes));
    return result;
}
async function runVerify(args) {
    const planPathInput = option(args, "plan");
    if (!planPathInput)
        throw new Error("verify requires --plan <file>.");
    const planPath = path.resolve(planPathInput);
    const plan = await readPlan(planPath);
    const root = path.resolve(option(args, "root") ?? plan.root);
    const planHash = readPlanHashes.get(plan);
    const registry = await registryFor(args);
    const currentRegistryHash = sha256(JSON.stringify(registry));
    const config = await loadConfig(root, option(args, "config"));
    const command = option(args, "command") ?? config.evaluations.default?.command;
    const timeout = Number(option(args, "timeout") ?? config.evaluations.default?.timeout_seconds ?? 600);
    if (!Number.isFinite(timeout) || timeout <= 0)
        throw new Error("--timeout must be a positive number of seconds.");
    const inputComparison = await comparePlanInputs(plan, root);
    const planConsistencyError = await validatePlanAgainstCurrentState(plan, root, registry, config, path.resolve(option(args, "plan")));
    let result;
    if (plan.registry_sha256 !== currentRegistryHash) {
        result = { passed: false, blocked: true, reason: "Migration blocked because the lifecycle registry changed after this plan was generated. Regenerate the plan and review its evidence." };
    }
    else if (inputComparison.mismatches.length > 0) {
        result = { passed: false, blocked: true, reason: `Migration blocked because repository inputs changed after plan generation: ${inputComparison.mismatches.join("; ")}. Regenerate the plan.` };
    }
    else if (planConsistencyError) {
        result = { passed: false, blocked: true, reason: `Migration blocked: ${planConsistencyError}` };
    }
    else {
        result = verifyPlan(plan, command, root, timeout);
        const after = await comparePlanInputs(plan, root);
        if (sha256(JSON.stringify(await loadConfig(root, option(args, "config")))) !== plan.config_sha256 || JSON.stringify(await snapshotWorkspace(root, plan.excluded_artifacts ?? [])) !== JSON.stringify(plan.workspace_inputs) || after.mismatches.length || sha256(await readFile(planPath)) !== planHash || sha256(JSON.stringify(await registryFor(args))) !== currentRegistryHash) {
            result = { ...result, passed: false, blocked: true, reason: "Plan, registry or repository inputs changed during evaluation; regenerate and rerun." };
        }
    }
    const evidence = {
        schema_version: "0.2",
        generated_at: new Date().toISOString(),
        root,
        ...(plan.workspace_inputs ? { workspace_inputs: plan.workspace_inputs } : {}),
        ...(plan.config_sha256 ? { config_sha256: plan.config_sha256 } : {}),
        plan_sha256: planHash,
        ...(plan.registry_sha256 ? { registry_sha256: plan.registry_sha256 } : {}),
        migrations: plan.migrations.map(({ from, to, authority, risk, changes, required_gates, occurrences, source, lifecycle_source }) => ({ from, to, authority, risk, changes, required_gates, occurrences, source, lifecycle_source })),
        inputs: inputComparison.current.length ? inputComparison.current : (plan.repository_inputs ?? []),
        passed: result.passed,
        blocked: result.blocked,
        reason: result.reason,
        ...(result.evaluation ? { evaluation: result.evaluation } : {}),
        compatibility_claim: "This artifact records only the configured checks and exact input hashes. Passing does not prove compatibility for all prompts, inputs, tools, deployments, or production traffic."
    };
    const format = option(args, "format") ?? (option(args, "output")?.endsWith(".json") ? "json" : option(args, "output")?.endsWith(".md") ? "markdown" : "text");
    let content;
    if (format === "json")
        content = `${JSON.stringify(evidence, null, 2)}\n`;
    else if (format === "markdown")
        content = renderEvidenceMarkdown(evidence);
    else if (format === "text") {
        content = `${result.passed ? "EVALUATION GATES PASSED" : "MIGRATION BLOCKED"}\n${result.reason}\nPlan SHA-256: ${planHash}\nRegistry SHA-256: ${currentRegistryHash}\n`;
        if (result.evaluation)
            content += `Command: ${result.evaluation.command}\nExit code: ${String(result.evaluation.exit_code)}\nDuration: ${result.evaluation.duration_ms} ms\nstdout SHA-256: ${result.evaluation.stdout_sha256}\nstderr SHA-256: ${result.evaluation.stderr_sha256}\n`;
    }
    else
        throw new Error(`Unsupported verify format: ${format}`);
    const outputPath = option(args, "output");
    if (outputPath)
        await writeArtifact(content, outputPath);
    else
        await emit(content);
    return result.passed ? 0 : 1;
}
async function runApply(args) {
    const planPath = option(args, "plan");
    if (!planPath)
        throw new Error("apply requires --plan <file>.");
    const plan = await readPlan(planPath);
    const root = path.resolve(option(args, "root") ?? plan.root);
    const write = hasFlag(args, "write");
    const registry = await registryFor(args);
    const config = await loadConfig(root, option(args, "config"));
    const planConsistencyError = await validatePlanAgainstCurrentState(plan, root, registry, config, path.resolve(option(args, "plan")));
    if (planConsistencyError) {
        process.stdout.write(`blocked: ${planConsistencyError}\n`);
        return 1;
    }
    if (plan.registry_sha256 !== sha256(JSON.stringify(registry))) {
        process.stdout.write("blocked: lifecycle registry changed since the plan was generated; regenerate the plan.\n");
        return 1;
    }
    const inputComparison = await comparePlanInputs(plan, root);
    if (inputComparison.mismatches.length > 0) {
        process.stdout.write("blocked: migration inputs changed since the plan was generated.\n");
        for (const reason of inputComparison.mismatches)
            process.stdout.write(`  ${reason}\n`);
        return 1;
    }
    if (sha256(await readFile(planPath)) !== readPlanHashes.get(plan))
        throw new Error("Plan bytes changed before apply.");
    const result = await applyMigrationPlan(plan, root, write, registry);
    process.stdout.write(`${write ? "APPLY RESULT" : "DRY RUN — no files changed"}\n`);
    for (const file of result.changed_files)
        process.stdout.write(`  ${write ? "updated" : "would update"}: ${file}\n`);
    for (const reason of result.blocked)
        process.stdout.write(`  blocked: ${reason}\n`);
    if (!write && result.changed_files.length > 0)
        process.stdout.write("Pass --write to apply eligible exact edits.\n");
    return result.blocked.length > 0 ? 1 : 0;
}
async function runRegistry(args) {
    const subcommand = args.positionals[0];
    const registryPath = option(args, "registry");
    if (subcommand === "validate") {
        const registry = await loadRegistry(registryPath);
        process.stdout.write(`Registry valid: schema ${registry.schema_version}, ${registry.models.length} model record(s), generated ${registry.generated_at}.\n`);
        return 0;
    }
    if (subcommand === "info") {
        const registry = await loadRegistry(registryPath);
        const ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(registry.generated_at)) / 86_400_000));
        process.stdout.write(`Registry generated: ${registry.generated_at}\nSnapshot age: ${ageDays} day(s)\nRecords: ${registry.models.length}\n`);
        for (const provider of ["openai", "anthropic", "google"]) {
            const records = registry.models.filter((model) => model.provider === provider);
            const counts = new Map();
            for (const record of records)
                counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
            process.stdout.write(`  ${provider}: ${records.length} record(s)${records.length ? ` — ${[...counts.entries()].map(([status, count]) => `${status}=${count}`).join(", ")}` : ""}\n`);
        }
        const staleSources = registry.models.filter((model) => (Date.now() - Date.parse(model.source.observed_at)) / 86_400_000 > 30
            || (model.replacement_source !== undefined && (Date.now() - Date.parse(model.replacement_source.observed_at)) / 86_400_000 > 30)).length;
        process.stdout.write(`Source records older than 30 days: ${staleSources}\n`);
        if (registry.models.length === 0)
            process.stdout.write("No lifecycle facts are bundled. Import a reviewed official snapshot or run provider sync.\n");
        if (ageDays > 30 || staleSources > 0)
            process.stdout.write("WARNING: some lifecycle evidence is stale; refresh and review official lifecycle sources before relying on it.\n");
        return 0;
    }
    if (subcommand === "sync") {
        const provider = option(args, "provider");
        if (provider !== "openai" && provider !== "anthropic" && provider !== "google")
            throw new Error("registry sync requires --provider openai|anthropic|google.");
        const sourceInfo = PROVIDER_SOURCES.find((source) => source.provider === provider);
        let imported;
        const input = option(args, "input");
        const live = hasFlag(args, "live");
        const pruneMissing = hasFlag(args, "prune-missing");
        if (input && live)
            throw new Error("Use either --input or --live, not both.");
        if (pruneMissing)
            throw new Error("Pruning is disabled: a parsed page does not prove complete provider history.");
        let liveSourceHash;
        if (input) {
            imported = await importReviewedSnapshot(path.resolve(input), provider);
        }
        else if (provider === "openai") {
            imported = await fetchOpenAILifecycle().catch(error => { if (!process.env.OPENAI_API_KEY)
                throw error; throw new SourceError(errorMessage(error)); });
        }
        else if (live) {
            const liveResult = await fetchOfficialLifecyclePage(provider).catch(error => { throw new SourceError(errorMessage(error)); });
            imported = { generated_at: liveResult.generated_at, models: liveResult.models };
            liveSourceHash = liveResult.source_sha256;
            process.stdout.write(`Fetched official ${provider} lifecycle page: ${liveResult.final_url}\n`);
            process.stdout.write(`Source HTML SHA-256: ${liveResult.source_sha256}; parsed ${liveResult.models.length} model row(s).\n`);
        }
        else {
            throw new Error(`${provider} sync requires --live to fetch the official lifecycle page, or --input <reviewed-snapshot.json>. Source: ${sourceInfo.lifecycleDocs}`);
        }
        const outputPath = option(args, "output") ?? registryPath;
        if (!outputPath)
            throw new Error("Refusing to overwrite the bundled registry. Supply --registry <existing-file> or --output <file>.");
        let existing;
        try {
            existing = await loadRegistry(registryPath ?? outputPath);
        }
        catch (error) {
            if (errorMessage(error).includes("ENOENT"))
                existing = { schema_version: "0.1", generated_at: imported.generated_at, models: [] };
            else
                throw error;
        }
        const retained = existing.models;
        const byIdentity = new Map(retained.map((model) => [`${model.provider}\0${model.surface}\0${model.model_id}`, model]));
        for (const model of imported.models) {
            const key = `${model.provider}\0${model.surface}\0${model.model_id}`;
            const previous = byIdentity.get(key);
            if (provider === "openai" && !input && previous && previous.recommended_replacements.length > 0 && model.recommended_replacements.length === 0) {
                byIdentity.set(key, {
                    ...model,
                    recommended_replacements: previous.recommended_replacements,
                    replacement_source: previous.replacement_source ?? previous.source
                });
            }
            else
                byIdentity.set(key, model);
        }
        const merged = {
            schema_version: "0.1",
            last_successful_sync: { ...existing.last_successful_sync, [provider]: new Date().toISOString() },
            generated_at: new Date().toISOString(),
            models: [...byIdentity.values()].sort((a, b) => a.provider.localeCompare(b.provider) || a.surface.localeCompare(b.surface) || a.model_id.localeCompare(b.model_id))
        };
        await writeRegistry(outputPath, validateRegistry(merged));
        process.stdout.write(`Imported ${imported.models.length} lifecycle record(s) for ${provider}. Registry now has ${merged.models.length} record(s): ${path.resolve(outputPath)}\n`);
        if (provider === "openai" && !input && imported.models.length === 0)
            process.stdout.write("No shutdown_date fields were returned by the API response. No lifecycle status or replacement was inferred.\n");
        if (input)
            process.stdout.write("Evidence mode: reviewed snapshot; snapshot hash identifies the imported JSON artifact, not the source webpage.\n");
        else if (provider === "openai")
            process.stdout.write("Evidence mode: live API response; sha256 identifies the fetched response bytes.\n");
        else
            process.stdout.write(`Evidence mode: live official HTML page; sha256 identifies fetched source bytes (${liveSourceHash}).\n`);
        if (provider !== "openai" && !input)
            process.stdout.write("Merge mode: records absent from the page were retained. Pruning is disabled.\n");
        return 0;
    }
    throw new Error("registry command must be validate, info, or sync.");
}
async function main() {
    const [command, ...rest] = process.argv.slice(2);
    if (!command || command === "--help" || command === "-h" || command === "help") {
        process.stdout.write(help());
        return 0;
    }
    if (command === "--version" || command === "-v") {
        process.stdout.write("0.4.1\n");
        return 0;
    }
    const args = parseArgs(rest);
    if (hasFlag(args, "help")) {
        process.stdout.write(help());
        return 0;
    }
    if (command === "scan" || command === "check")
        return runScan(command, args);
    if (command === "plan")
        return runPlan(args);
    if (command === "benchmark" || command === "benchmark-repos") {
        const scriptName = command === "benchmark" ? "benchmark.mjs" : "benchmark-real-repos.mjs";
        const script = fileURLToPath(new URL(`../scripts/${scriptName}`, import.meta.url));
        const result = spawnSync(process.execPath, [script, ...process.argv.slice(3)], { stdio: "inherit", env: process.env });
        if (result.error)
            throw result.error;
        return typeof result.status === "number" ? result.status : 2;
    }
    if (command === "verify")
        return runVerify(args);
    if (command === "apply")
        return runApply(args);
    if (command === "registry")
        return runRegistry(args);
    throw new Error(`Unknown command: ${command}\n\n${help()}`);
}
main().then((exitCode) => {
    process.exitCode = exitCode;
}).catch((error) => {
    process.stderr.write(`modeldeps: ${errorMessage(error)}\n`);
    process.exitCode = error instanceof SourceError ? 3 : 2;
});
//# sourceMappingURL=cli.js.map