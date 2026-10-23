import test from "node:test";
import assert from "node:assert/strict";
import { gateWithoutEvaluation, verifyPlan } from "../eval-gate.js";
const plan = {
    schema_version: "0.2",
    generated_at: "2026-10-23T00:00:00.000Z",
    root: process.cwd(),
    migrations: [{
            from: { provider: "openai", surface: "openai-api", model_id: "old-model" },
            to: { provider: "openai", surface: "openai-api", model_id: "new-model" },
            authority: "provider", risk: "R3", changes: ["tool_contract_change"],
            required_gates: ["configured-eval"], autofixable: false,
            occurrences: [], source: { kind: "fixture", url: "fixture://test", observed_at: "2026-10-23T00:00:00.000Z" },
            lifecycle_source: { kind: "fixture", url: "fixture://test", observed_at: "2026-10-23T00:00:00.000Z" }
        }],
    notes: []
};
test("blocks a higher-risk migration when no eval command is supplied", () => {
    const result = gateWithoutEvaluation(plan);
    assert.equal(result.passed, false);
    assert.equal(result.blocked, true);
});
test("passes only when the configured command exits zero", () => {
    const result = verifyPlan(plan, 'node -e "process.exit(0)"', process.cwd(), 5);
    assert.equal(result.passed, true);
    assert.equal(result.evaluation?.exit_code, 0);
});
test("blocks a migration when the eval command fails", () => {
    const result = verifyPlan(plan, 'node -e "process.exit(7)"', process.cwd(), 5);
    assert.equal(result.passed, false);
    assert.equal(result.evaluation?.exit_code, 7);
});
//# sourceMappingURL=eval-gate.test.js.map