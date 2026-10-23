import type { EvaluationResult, GateResult, MigrationPlan } from "./types.js";
export declare function gateWithoutEvaluation(plan: MigrationPlan): GateResult;
export declare function runEvaluation(command: string, cwd: string, timeoutSeconds?: number): EvaluationResult;
export declare function verifyPlan(plan: MigrationPlan, command: string | undefined, cwd: string, timeoutSeconds?: number): GateResult;
