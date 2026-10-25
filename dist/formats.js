const ICON = { error: "✗", warning: "⚠", info: "✓", unknown: "?" };
export function renderScanText(findings) {
    if (findings.length === 0)
        return "No model references found.\n";
    const lines = [`Found ${findings.length} model reference(s):`];
    for (const finding of findings) {
        lines.push(`  ${finding.file}:${finding.line}:${finding.column}  ${finding.provider}/${finding.surface}/${finding.model_id}  (confidence ${finding.confidence.toFixed(2)})`);
    }
    return `${lines.join("\n")}\n`;
}
export function renderCheckText(result) {
    const lines = [
        `ModelDeps check — ${result.root}`,
        `References: ${result.summary.references} | Unique models: ${result.summary.unique_models} | Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings} | Unknown: ${result.summary.unknown}`,
        `Registry: ${result.registry.records} record(s), snapshot age ${result.registry.age_days} day(s)${result.registry.stale ? " — STALE" : ""}${result.registry.empty ? " — EMPTY (unknown is not active)" : ""}`,
        `Source records older than ${result.registry.max_source_age_days} days: ${result.registry.stale_source_records}`
    ];
    if (result.registry.stale)
        lines.push(`  ⚠ Registry or lifecycle evidence is older than ${result.registry.max_source_age_days} days; refresh and review official lifecycle sources.`);
    if (result.registry.empty)
        lines.push("  ? No lifecycle records are bundled. Import a reviewed registry before relying on lifecycle checks.");
    if (result.findings.length === 0)
        lines.push("No model references found.");
    for (const finding of result.findings) {
        const diagnostics = result.diagnostics.filter((diagnostic) => diagnostic.finding.file === finding.file
            && diagnostic.finding.line === finding.line
            && diagnostic.finding.column === finding.column
            && diagnostic.finding.model_id === finding.model_id);
        if (diagnostics.length === 0) {
            lines.push(`  ✓ ${finding.file}:${finding.line} ${finding.provider}/${finding.model_id} — no policy issue detected`);
        }
        else {
            for (const diagnostic of diagnostics) {
                lines.push(`  ${ICON[diagnostic.severity]} ${finding.file}:${finding.line}:${finding.column} ${finding.provider}/${finding.model_id} — ${diagnostic.message}`);
                if (diagnostic.source_url)
                    lines.push(`      source: ${diagnostic.source_url}`);
                if (diagnostic.source_observed_at)
                    lines.push(`      observed: ${diagnostic.source_observed_at}${diagnostic.source_evidence_mode ? ` (${diagnostic.source_evidence_mode})` : ""}`);
                if (diagnostic.source_sha256)
                    lines.push(`      source response sha256: ${diagnostic.source_sha256}`);
                if (diagnostic.source_snapshot_sha256)
                    lines.push(`      reviewed snapshot sha256: ${diagnostic.source_snapshot_sha256}`);
            }
        }
    }
    if (result.summary.unknown > 0)
        lines.push("Note: unknown means no matching lifecycle record was found; it does not mean the model is active.");
    return `${lines.join("\n")}\n`;
}
function ruleId(diagnostic) {
    return diagnostic.code.replace(/[^A-Za-z0-9_.-]/g, "_");
}
export function toSarif(result) {
    const uniqueRules = new Map();
    for (const diagnostic of result.diagnostics) {
        const id = ruleId(diagnostic);
        if (!uniqueRules.has(id)) {
            uniqueRules.set(id, {
                id,
                shortDescription: { text: diagnostic.message.slice(0, 120) },
                defaultConfiguration: { level: diagnostic.severity === "error" ? "error" : diagnostic.severity === "info" ? "note" : "warning" }
            });
        }
    }
    const results = result.diagnostics.map((diagnostic) => ({
        ruleId: ruleId(diagnostic),
        level: diagnostic.severity === "error" ? "error" : diagnostic.severity === "info" ? "note" : "warning",
        message: { text: diagnostic.message },
        locations: [{
                physicalLocation: {
                    artifactLocation: { uri: diagnostic.finding.file },
                    region: { startLine: diagnostic.finding.line, startColumn: diagnostic.finding.column }
                }
            }],
        properties: {
            provider: diagnostic.finding.provider,
            surface: diagnostic.finding.surface,
            modelId: diagnostic.finding.model_id,
            confidence: diagnostic.finding.confidence,
            ...(diagnostic.source_url ? { sourceUrl: diagnostic.source_url } : {}),
            ...(diagnostic.source_evidence_mode ? { sourceEvidenceMode: diagnostic.source_evidence_mode } : {}),
            ...(diagnostic.source_observed_at ? { sourceObservedAt: diagnostic.source_observed_at } : {}),
            ...(diagnostic.source_sha256 ? { sourceSha256: diagnostic.source_sha256 } : {}),
            ...(diagnostic.source_snapshot_sha256 ? { sourceSnapshotSha256: diagnostic.source_snapshot_sha256 } : {}),
            ...(diagnostic.days_to_shutdown !== undefined ? { daysToShutdown: diagnostic.days_to_shutdown } : {}),
            ...(diagnostic.shutdown_date_kind ? { shutdownDateKind: diagnostic.shutdown_date_kind } : {})
        }
    }));
    return {
        $schema: "https://json.schemastore.org/sarif-2.1.0.json",
        version: "2.1.0",
        runs: [{
                tool: {
                    driver: {
                        name: "ModelDeps",
                        informationUri: "https://github.com/modeldeps/modeldeps",
                        semanticVersion: "0.4.1",
                        rules: [...uniqueRules.values()]
                    }
                },
                results
            }]
    };
}
export function renderGitHubSummary(result) {
    const lines = [
        "## ModelDeps lifecycle check",
        "",
        `- References: **${result.summary.references}**`,
        `- Unique models: **${result.summary.unique_models}**`,
        `- Errors: **${result.summary.errors}**`,
        `- Warnings: **${result.summary.warnings}**`,
        `- Unknown lifecycle records: **${result.summary.unknown}**`,
        `- Registry snapshot: **${result.registry.records}** record(s), age **${result.registry.age_days}** day(s)`,
        `- Source records older than ${result.registry.max_source_age_days} days: **${result.registry.stale_source_records}**`,
        ""
    ];
    if (result.registry.stale)
        lines.push(`⚠️ Registry or lifecycle evidence is older than ${result.registry.max_source_age_days} days; refresh and review official lifecycle sources.`, "");
    if (result.registry.empty)
        lines.push("❔ Registry is empty; discovered models cannot be classified as active.", "");
    if (result.diagnostics.length === 0)
        lines.push("No model-specific lifecycle policy issues were detected.", "");
    for (const diagnostic of result.diagnostics) {
        const symbol = diagnostic.severity === "error" ? "❌" : diagnostic.severity === "warning" ? "⚠️" : diagnostic.severity === "unknown" ? "❔" : "ℹ️";
        lines.push(`- ${symbol} \`${diagnostic.finding.file}:${diagnostic.finding.line}\` **${diagnostic.finding.model_id}** — ${diagnostic.message}`);
        if (diagnostic.source_url)
            lines.push(`  - Source: ${diagnostic.source_url}`);
        if (diagnostic.source_observed_at)
            lines.push(`  - Evidence observed: ${diagnostic.source_observed_at}${diagnostic.source_evidence_mode ? ` (${diagnostic.source_evidence_mode})` : ""}`);
        if (diagnostic.source_sha256)
            lines.push(`  - Source response SHA-256: \`${diagnostic.source_sha256}\``);
        if (diagnostic.source_snapshot_sha256)
            lines.push(`  - Reviewed snapshot SHA-256: \`${diagnostic.source_snapshot_sha256}\``);
    }
    lines.push("", "Unknown lifecycle data is not treated as evidence that a model is active.");
    return `${lines.join("\n")}\n`;
}
export function renderMigrationPlanMarkdown(plan) {
    const lines = [
        "# ModelDeps Migration Plan",
        "",
        `- Generated: ${plan.generated_at}`,
        `- Repository: \`${plan.root}\``,
        `- Registry SHA-256: \`${plan.registry_sha256 ?? "not recorded"}\``,
        `- Migration candidates: ${plan.migrations.length}`,
        "",
        "> A provider-declared replacement is a candidate, not proof of compatibility. Run the required evals before treating a migration as verified.",
        ""
    ];
    if (plan.migrations.length === 0)
        lines.push("No migration candidates were found.", "");
    for (const [index, migration] of plan.migrations.entries()) {
        lines.push(`## ${index + 1}. ${migration.from.model_id} → ${migration.to.model_id}`, "");
        lines.push(`- From: \`${migration.from.provider}/${migration.from.surface}/${migration.from.model_id}\``);
        lines.push(`- To: \`${migration.to.provider}/${migration.to.surface}/${migration.to.model_id}\``);
        lines.push(`- Authority: ${migration.authority}`);
        lines.push(`- Risk: **${migration.risk}**`);
        lines.push(`- Changes: ${migration.changes.length ? migration.changes.join(", ") : "none declared"}`);
        lines.push(`- Required gates: ${migration.required_gates.length ? migration.required_gates.join(", ") : "none configured"}`);
        lines.push(`- Autofixable: ${migration.autofixable ? "yes" : "no"}`);
        lines.push(`- Evidence observed: ${migration.source.observed_at}`);
        lines.push(`- Evidence mode: ${migration.source.evidence_mode ?? "legacy/unspecified"}`);
        if (migration.source.url)
            lines.push(`- Replacement source: ${migration.source.url}`);
        if (migration.lifecycle_source.url)
            lines.push(`- Lifecycle source: ${migration.lifecycle_source.url}`);
        if (migration.source.sha256)
            lines.push(`- Source response SHA-256: \`${migration.source.sha256}\``);
        if (migration.source.snapshot_sha256)
            lines.push(`- Reviewed snapshot SHA-256: \`${migration.source.snapshot_sha256}\``);
        lines.push("- Occurrences:");
        for (const occurrence of migration.occurrences)
            lines.push(`  - \`${occurrence.file}:${occurrence.line}:${occurrence.column}\``);
        lines.push("");
    }
    lines.push("## Notes", "", ...plan.notes.map((note) => `- ${note}`), "");
    if (plan.repository_inputs?.length) {
        lines.push("## Input file hashes", "", ...plan.repository_inputs.map((input) => `- \`${input.path}\`: \`${input.sha256}\``), "");
    }
    return `${lines.join("\n")}\n`;
}
export function renderEvidenceMarkdown(evidence) {
    const lines = [
        "# ModelDeps Migration Verification Evidence",
        "",
        `- Result: **${evidence.blocked ? "BLOCKED" : evidence.passed ? "GATES PASSED" : "NOT PASSED"}**`,
        `- Generated: ${evidence.generated_at}`,
        `- Repository: \`${evidence.root}\``,
        `- Plan SHA-256: \`${evidence.plan_sha256}\``,
        `- Registry SHA-256: \`${evidence.registry_sha256 ?? "not recorded"}\``,
        `- Reason: ${evidence.reason}`,
        "",
        `> ${evidence.compatibility_claim}`,
        "",
        "## Migrations",
        ""
    ];
    if (evidence.migrations.length === 0)
        lines.push("No migration candidates were included.", "");
    for (const migration of evidence.migrations) {
        lines.push(`### ${migration.from.model_id} → ${migration.to.model_id}`, "");
        lines.push(`- From: \`${migration.from.provider}/${migration.from.surface}/${migration.from.model_id}\``);
        lines.push(`- To: \`${migration.to.provider}/${migration.to.surface}/${migration.to.model_id}\``);
        lines.push(`- Risk: ${migration.risk}`);
        lines.push(`- Changes: ${migration.changes.join(", ") || "none declared"}`);
        lines.push(`- Required gates: ${migration.required_gates.join(", ") || "none"}`);
        lines.push(`- Source observed: ${migration.source.observed_at}`);
        if (migration.source.url)
            lines.push(`- Replacement source: ${migration.source.url}`);
        if (migration.lifecycle_source.url)
            lines.push(`- Lifecycle source: ${migration.lifecycle_source.url}`);
        lines.push("");
    }
    lines.push("## Input hashes", "");
    if (evidence.inputs.length)
        for (const input of evidence.inputs)
            lines.push(`- \`${input.path}\`: \`${input.sha256}\``);
    else
        lines.push("No repository input hashes were recorded.");
    lines.push("");
    if (evidence.evaluation) {
        lines.push("## Evaluation", "", `- Command: \`${evidence.evaluation.command}\``, `- Exit code: ${String(evidence.evaluation.exit_code)}`, `- Passed: ${evidence.evaluation.passed}`, `- Timed out: ${evidence.evaluation.timed_out}`, `- Started: ${evidence.evaluation.started_at}`, `- Finished: ${evidence.evaluation.finished_at}`, `- Duration: ${evidence.evaluation.duration_ms} ms`, `- stdout SHA-256: \`${evidence.evaluation.stdout_sha256}\``, `- stderr SHA-256: \`${evidence.evaluation.stderr_sha256}\``, "");
    }
    else {
        lines.push("## Evaluation", "", "No evaluation command result was recorded.", "");
    }
    return `${lines.join("\n")}\n`;
}
//# sourceMappingURL=formats.js.map