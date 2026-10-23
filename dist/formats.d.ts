import type { CheckResult, MigrationEvidence, MigrationPlan, ModelFinding } from "./types.js";
export declare function renderScanText(findings: ModelFinding[]): string;
export declare function renderCheckText(result: CheckResult): string;
export declare function toSarif(result: CheckResult): Record<string, unknown>;
export declare function renderGitHubSummary(result: CheckResult): string;
export declare function renderMigrationPlanMarkdown(plan: MigrationPlan): string;
export declare function renderEvidenceMarkdown(evidence: MigrationEvidence): string;
