import { spawnSync } from "node:child_process";
import { sha256 } from "./util.js";
export function gateWithoutEvaluation(plan) {
    const required = plan.migrations.filter((migration) => migration.required_gates.length > 0);
    if (required.length === 0)
        return { passed: true, blocked: false, reason: "No migration in this plan requires an evaluation gate; this is not a universal compatibility guarantee." };
    return {
        passed: false,
        blocked: true,
        reason: `Blocked: ${required.length} migration(s) require evaluation. Run the repository-owned eval command and review its result.`
    };
}
export function runEvaluation(command, cwd, timeoutSeconds = 600) {
    const started = new Date();
    const result = spawnSync(command, {
        cwd,
        shell: true,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutSeconds * 1000,
        env: process.env
    });
    const finished = new Date();
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    // Preserve interactive visibility while retaining hashes instead of raw output in evidence.
    if (stdout)
        process.stdout.write(stdout);
    if (stderr)
        process.stderr.write(stderr);
    const duration_ms = finished.getTime() - started.getTime();
    const timed_out = result.error?.name === "Error" && /timed out|ETIMEDOUT/i.test(result.error.message);
    const exit_code = typeof result.status === "number" ? result.status : null;
    const passed = exit_code === 0 && !result.error && !timed_out;
    return {
        command,
        passed,
        exit_code,
        signal: result.signal,
        duration_ms,
        timed_out,
        started_at: started.toISOString(),
        finished_at: finished.toISOString(),
        stdout_sha256: sha256(stdout),
        stderr_sha256: sha256(stderr)
    };
}
export function verifyPlan(plan, command, cwd, timeoutSeconds = 600) {
    const required = plan.migrations.filter((migration) => migration.required_gates.length > 0);
    if (required.length === 0)
        return { passed: true, blocked: false, reason: "No configured evaluation gate is required by this migration plan. This does not prove universal compatibility." };
    if (!command || command.trim() === "")
        return gateWithoutEvaluation(plan);
    const evaluation = runEvaluation(command, cwd, timeoutSeconds);
    return {
        passed: evaluation.passed,
        blocked: !evaluation.passed,
        reason: evaluation.passed
            ? "Configured evaluation command exited successfully. This is evidence for this command and input set only, not a universal proof of compatibility."
            : `Migration blocked because the configured evaluation command did not pass${evaluation.timed_out ? " before timeout" : ""}.`,
        evaluation
    };
}
//# sourceMappingURL=eval-gate.js.map