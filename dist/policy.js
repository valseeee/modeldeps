import path from "node:path";
import { daysUntil } from "./util.js";
import { resolveModel } from "./registry.js";
function statusSeverity(status, policy) {
    if (policy.fail_on.includes(status))
        return "error";
    if (status === "retired" || status === "deprecated")
        return "warning";
    if (status === "unknown")
        return policy.fail_on_unknown ? "error" : "unknown";
    return "info";
}
function ageDays(observedAt, now) {
    return Math.max(0, Math.floor((now.getTime() - Date.parse(observedAt)) / 86_400_000));
}
export function checkModels(findings, registry, policy, root, now = new Date()) {
    const diagnostics = [];
    for (const finding of findings) {
        const record = resolveModel(registry, finding.provider, finding.surface, finding.model_id);
        if (!record) {
            diagnostics.push({
                code: finding.resolution === "ambiguous-surface" ? "MODEL_SURFACE_AMBIGUOUS" : "MODEL_UNKNOWN",
                severity: policy.fail_on_unknown ? "error" : "unknown",
                message: finding.resolution === "ambiguous-surface"
                    ? `Model ID exists on multiple deployment surfaces; refusing to choose one automatically for ${finding.model_id}.`
                    : `No lifecycle record for ${finding.provider}/${finding.surface}/${finding.model_id}. Unknown does not mean active.`,
                finding
            });
            continue;
        }
        const source_url = record.source.url;
        const provenance = {
            ...(source_url ? { source_url } : {}),
            ...(record.source.evidence_mode ? { source_evidence_mode: record.source.evidence_mode } : {}),
            source_observed_at: record.source.observed_at,
            ...(record.source.sha256 ? { source_sha256: record.source.sha256 } : {}),
            ...(record.source.snapshot_sha256 ? { source_snapshot_sha256: record.source.snapshot_sha256 } : {})
        };
        const recordAge = ageDays(record.source.observed_at, now);
        const replacementSource = record.replacement_source;
        const replacementAge = replacementSource ? ageDays(replacementSource.observed_at, now) : recordAge;
        if (recordAge > policy.max_source_age_days) {
            diagnostics.push({
                code: "MODEL_SOURCE_STALE",
                severity: "warning",
                message: `Lifecycle evidence is ${recordAge} day(s) old (limit: ${policy.max_source_age_days}); re-review the official source before relying on this record.`,
                finding,
                status: record.status,
                ...provenance
            });
        }
        if (record.recommended_replacements.length > 0 && replacementSource && replacementAge > policy.max_source_age_days) {
            diagnostics.push({
                code: "MODEL_REPLACEMENT_SOURCE_STALE",
                severity: "warning",
                message: `Replacement recommendation evidence is ${replacementAge} day(s) old (limit: ${policy.max_source_age_days}); re-check the provider's current migration guidance.`,
                finding,
                status: record.status,
                ...(replacementSource.url ? { source_url: replacementSource.url } : {}),
                ...(replacementSource.evidence_mode ? { source_evidence_mode: replacementSource.evidence_mode } : {}),
                source_observed_at: replacementSource.observed_at,
                ...(replacementSource.sha256 ? { source_sha256: replacementSource.sha256 } : {}),
                ...(replacementSource.snapshot_sha256 ? { source_snapshot_sha256: replacementSource.snapshot_sha256 } : {})
            });
        }
        const severity = statusSeverity(record.status, policy);
        if (record.status === "retired" || record.status === "deprecated" || record.status === "preview" || record.status === "unknown") {
            diagnostics.push({
                code: `MODEL_${record.status.toUpperCase()}`,
                severity,
                message: `Model lifecycle status is ${record.status}.`,
                finding,
                status: record.status,
                ...provenance
            });
        }
        if (record.shutdown_at) {
            const days = daysUntil(record.shutdown_at, now);
            const dateKind = record.shutdown_date_kind ?? "confirmed";
            const isEarliestPossible = dateKind === "earliest-possible" || dateKind === "tentative";
            if (days <= 0 && record.status !== "retired") {
                diagnostics.push({
                    code: isEarliestPossible ? "MODEL_EARLIEST_SHUTDOWN_DATE_PASSED" : "MODEL_SHUTDOWN_DATE_PASSED",
                    severity: isEarliestPossible ? "warning" : "error",
                    message: isEarliestPossible
                        ? `The provider's earliest-possible shutdown date ${record.shutdown_at} has passed; this is not proof the endpoint is shut down. Re-check the current official lifecycle source.`
                        : `Recorded shutdown date ${record.shutdown_at} has passed; verify the provider's current lifecycle data.`,
                    finding,
                    status: record.status,
                    days_to_shutdown: days,
                    shutdown_date_kind: dateKind,
                    ...provenance
                });
            }
            else if (days > 0 && days <= policy.fail_days_before_shutdown) {
                diagnostics.push({
                    code: isEarliestPossible ? "MODEL_EARLIEST_SHUTDOWN_DATE_APPROACHING" : "MODEL_SHUTDOWN_IMMINENT",
                    severity: isEarliestPossible ? "warning" : "error",
                    message: isEarliestPossible
                        ? `The earliest-possible shutdown date is in ${days} day(s) on ${record.shutdown_at}; confirm the provider's exact shutdown status before treating this as a hard deadline.`
                        : `Scheduled shutdown is in ${days} day(s) on ${record.shutdown_at}; policy fails within ${policy.fail_days_before_shutdown} days.`,
                    finding,
                    status: record.status,
                    days_to_shutdown: days,
                    shutdown_date_kind: dateKind,
                    ...provenance
                });
            }
            else if (days > 0 && days <= policy.warn_days_before_shutdown) {
                diagnostics.push({
                    code: isEarliestPossible ? "MODEL_EARLIEST_SHUTDOWN_DATE_APPROACHING" : "MODEL_SHUTDOWN_APPROACHING",
                    severity: "warning",
                    message: isEarliestPossible
                        ? `The provider's earliest-possible shutdown date is in ${days} day(s) on ${record.shutdown_at}; confirm the exact date in the current official source.`
                        : `Scheduled shutdown is in ${days} day(s) on ${record.shutdown_at}.`,
                    finding,
                    status: record.status,
                    days_to_shutdown: days,
                    shutdown_date_kind: dateKind,
                    ...provenance
                });
            }
        }
    }
    const uniqueModels = new Set(findings.map((finding) => `${finding.provider}\0${finding.surface}\0${finding.model_id}`));
    const registryAge = ageDays(registry.generated_at, now);
    const staleSourceRecords = registry.models.filter((record) => ageDays(record.source.observed_at, now) > policy.max_source_age_days
        || (record.replacement_source !== undefined && ageDays(record.replacement_source.observed_at, now) > policy.max_source_age_days)).length;
    return {
        schema_version: "0.2",
        generated_at: now.toISOString(),
        root: path.resolve(root),
        findings,
        diagnostics,
        registry: {
            records: registry.models.length,
            generated_at: registry.generated_at,
            age_days: registryAge,
            stale: registry.models.length === 0 || registryAge > policy.max_source_age_days || staleSourceRecords > 0,
            empty: registry.models.length === 0,
            stale_source_records: staleSourceRecords,
            max_source_age_days: policy.max_source_age_days
        },
        summary: {
            references: findings.length,
            unique_models: uniqueModels.size,
            errors: diagnostics.filter((item) => item.severity === "error").length,
            warnings: diagnostics.filter((item) => item.severity === "warning").length,
            unknown: diagnostics.filter((item) => item.severity === "unknown").length,
            info: diagnostics.filter((item) => item.severity === "info").length
        }
    };
}
export function checkExitCode(result) {
    return result.diagnostics.some((diagnostic) => diagnostic.severity === "error") ? 1 : 0;
}
//# sourceMappingURL=policy.js.map