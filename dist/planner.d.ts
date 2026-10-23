import { type MigrationPlan, type ModelFinding, type Policy, type RegistrySnapshot } from "./types.js";
export declare function planMigrations(findings: ModelFinding[], registry: RegistrySnapshot, root: string, now?: Date, policy?: Policy): MigrationPlan;
export interface ApplyResult {
    applied: boolean;
    changed_files: string[];
    blocked: string[];
    dry_run: boolean;
}
export declare function applyMigrationPlan(plan: MigrationPlan, rootInput: string, write: boolean, registry: RegistrySnapshot): Promise<ApplyResult>;
