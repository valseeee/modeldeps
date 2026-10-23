export type Provider = "openai" | "anthropic" | "google" | "unknown";
export type LifecycleStatus = "active" | "preview" | "deprecated" | "retired" | "unknown";
export type SourceKind = "official" | "maintainer" | "fixture";
export type EvidenceMode = "api-response" | "live-page" | "reviewed-snapshot" | "fixture" | "manual";
export type ShutdownDateKind = "confirmed" | "earliest-possible" | "tentative";
export type Severity = "error" | "warning" | "info" | "unknown";
export type RiskLevel = "R0" | "R1" | "R2" | "R3" | "R4" | "R5";
export interface Replacement {
    model_id: string;
    /** Defaults to the source model's provider when omitted. */
    provider?: Exclude<Provider, "unknown">;
    /** Defaults to the source model's surface when omitted. */
    surface?: string;
    authority: "provider" | "community";
    risk?: RiskLevel;
    changes?: string[];
}
export interface SourceProvenance {
    kind: SourceKind;
    url?: string;
    observed_at: string;
    /** SHA-256 of bytes fetched directly from the cited source, when available. */
    sha256?: string;
    /** SHA-256 of the locally reviewed/imported snapshot artifact; not the source webpage. */
    snapshot_sha256?: string;
    evidence_mode?: EvidenceMode;
    parser_version?: string;
}
export interface ModelRecord {
    provider: Exclude<Provider, "unknown">;
    surface: string;
    model_id: string;
    status: LifecycleStatus;
    announced_at?: string;
    shutdown_at?: string;
    /** Distinguishes a confirmed shutdown date from an earliest-possible or tentative date. */
    shutdown_date_kind?: ShutdownDateKind;
    recommended_replacements: Replacement[];
    /** Evidence for lifecycle status and shutdown dates. */
    source: SourceProvenance;
    /** Separate evidence for provider-declared replacements when it differs from lifecycle evidence. */
    replacement_source?: SourceProvenance;
    notes?: string;
}
export interface RegistrySnapshot {
    last_successful_sync?: Partial<Record<Exclude<Provider, "unknown">, string>>;
    schema_version: "0.1";
    generated_at: string;
    models: ModelRecord[];
}
export interface ModelFinding {
    provider: Provider;
    surface: string;
    model_id: string;
    file: string;
    line: number;
    column: number;
    confidence: number;
    evidence: string;
    resolution?: "registry-exact" | "provider-prefix" | "unknown" | "ambiguous-surface";
}
export interface Policy {
    fail_on: LifecycleStatus[];
    warn_days_before_shutdown: number;
    fail_days_before_shutdown: number;
    fail_on_unknown: boolean;
    require_eval_on: string[];
    max_source_age_days: number;
}
export interface ModelDiagnostic {
    code: string;
    severity: Severity;
    message: string;
    finding: ModelFinding;
    status?: LifecycleStatus;
    days_to_shutdown?: number;
    shutdown_date_kind?: ShutdownDateKind;
    source_url?: string;
    source_evidence_mode?: EvidenceMode;
    source_observed_at?: string;
    source_sha256?: string;
    source_snapshot_sha256?: string;
}
export interface CheckResult {
    schema_version: "0.2";
    generated_at: string;
    root: string;
    findings: ModelFinding[];
    diagnostics: ModelDiagnostic[];
    registry: {
        records: number;
        generated_at: string;
        age_days: number;
        stale: boolean;
        empty: boolean;
        stale_source_records: number;
        max_source_age_days: number;
    };
    summary: {
        references: number;
        unique_models: number;
        errors: number;
        warnings: number;
        unknown: number;
        info: number;
    };
}
export interface MigrationOccurrence {
    file: string;
    line: number;
    column: number;
}
export interface InputHash {
    path: string;
    sha256: string;
    expected_sha256?: string;
}
export interface MigrationPlanItem {
    from: {
        provider: Exclude<Provider, "unknown">;
        surface: string;
        model_id: string;
    };
    to: {
        provider: Exclude<Provider, "unknown">;
        surface: string;
        model_id: string;
    };
    authority: "provider" | "community";
    risk: RiskLevel;
    changes: string[];
    required_gates: string[];
    autofixable: boolean;
    occurrences: MigrationOccurrence[];
    /** Evidence that supports the replacement recommendation. */
    source: SourceProvenance;
    /** Evidence for the source model's lifecycle status and shutdown date. */
    lifecycle_source: SourceProvenance;
}
export interface MigrationPlan {
    evaluation?: {
        command: string | null;
        timeout_seconds: number;
        execution_status: "pending";
    };
    workspace_inputs?: InputHash[];
    excluded_artifacts?: string[];
    config_sha256?: string;
    schema_version: "0.2";
    generated_at: string;
    root: string;
    registry_sha256?: string;
    repository_inputs?: InputHash[];
    migrations: MigrationPlanItem[];
    notes: string[];
}
export interface EvaluationResult {
    command: string;
    passed: boolean;
    exit_code: number | null;
    signal: NodeJS.Signals | null;
    duration_ms: number;
    timed_out: boolean;
    started_at: string;
    finished_at: string;
    stdout_sha256: string;
    stderr_sha256: string;
}
export interface GateResult {
    passed: boolean;
    blocked: boolean;
    reason: string;
    evaluation?: EvaluationResult;
}
export interface MigrationEvidence {
    workspace_inputs?: InputHash[];
    config_sha256?: string;
    schema_version: "0.2";
    generated_at: string;
    root: string;
    plan_sha256: string;
    registry_sha256?: string;
    migrations: Array<Pick<MigrationPlanItem, "from" | "to" | "authority" | "risk" | "changes" | "required_gates" | "occurrences" | "source" | "lifecycle_source">>;
    inputs: InputHash[];
    passed: boolean;
    blocked: boolean;
    reason: string;
    evaluation?: EvaluationResult;
    compatibility_claim: string;
}
export declare const DEFAULT_POLICY: Policy;
