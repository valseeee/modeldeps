import type { CheckResult, ModelFinding, Policy, RegistrySnapshot } from "./types.js";
export declare function checkModels(findings: ModelFinding[], registry: RegistrySnapshot, policy: Policy, root: string, now?: Date): CheckResult;
export declare function checkExitCode(result: CheckResult): number;
