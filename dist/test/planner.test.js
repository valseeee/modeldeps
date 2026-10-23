import test from "node:test";
import assert from "node:assert/strict";
import { loadRegistry } from "../registry.js";
import { DEFAULT_POLICY } from "../types.js";
import { planMigrations } from "../planner.js";
import { fileURLToPath } from "node:url";
const registryPath = fileURLToPath(new URL("../../demo/registry.fixture.json", import.meta.url));
test("creates evidence-backed migration candidates and requires eval for behavior changes", async () => {
    const registry = await loadRegistry(registryPath);
    const finding = {
        provider: "openai", surface: "openai-api", model_id: "openai-demo-retired",
        file: "src/agent.ts", line: 3, column: 22, confidence: 0.99, evidence: 'model = "openai-demo-retired"'
    };
    const plan = planMigrations([finding], registry, "/repo", new Date("2026-10-23T00:00:00.000Z"));
    assert.equal(plan.migrations.length, 1);
    assert.equal(plan.migrations[0]?.to.model_id, "openai-demo-next");
    assert.equal(plan.migrations[0]?.risk, "R3");
    assert.deepEqual(plan.migrations[0]?.required_gates, ["configured-eval"]);
    assert.equal(plan.migrations[0]?.autofixable, false);
});
test("defaults unreviewed replacement risk to R3 instead of guessing from model names", async () => {
    const registry = await loadRegistry(registryPath);
    const oldRecord = registry.models.find((model) => model.model_id === "openai-demo-retired");
    assert.ok(oldRecord);
    oldRecord.recommended_replacements = [{ model_id: "openai-demo-next", authority: "provider" }];
    const finding = {
        provider: "openai", surface: "openai-api", model_id: "openai-demo-retired",
        file: "src/agent.ts", line: 3, column: 22, confidence: 0.99, evidence: 'model = "openai-demo-retired"'
    };
    const plan = planMigrations([finding], registry, "/repo", new Date("2026-10-23T00:00:00.000Z"));
    assert.equal(plan.migrations[0]?.risk, "R3");
    assert.deepEqual(plan.migrations[0]?.required_gates, ["configured-eval"]);
    assert.equal(plan.migrations[0]?.autofixable, false);
});
test("configured change types require an eval even when a replacement has a low risk label", async () => {
    const registry = await loadRegistry(registryPath);
    const oldRecord = registry.models.find((model) => model.model_id === "openai-demo-retired");
    assert.ok(oldRecord);
    oldRecord.recommended_replacements = [{ model_id: "openai-demo-next", authority: "provider", risk: "R0", changes: ["tool_contract_change"] }];
    const finding = {
        provider: "openai", surface: "openai-api", model_id: "openai-demo-retired",
        file: "src/agent.ts", line: 3, column: 22, confidence: 0.99, evidence: 'model = "openai-demo-retired"'
    };
    const plan = planMigrations([finding], registry, "/repo", new Date("2026-10-23T00:00:00.000Z"), DEFAULT_POLICY);
    assert.deepEqual(plan.migrations[0]?.required_gates, ["configured-eval"]);
    const noCustomGate = planMigrations([finding], registry, "/repo", new Date("2026-10-23T00:00:00.000Z"), { ...DEFAULT_POLICY, require_eval_on: [] });
    assert.deepEqual(noCustomGate.migrations[0]?.required_gates, []);
});
//# sourceMappingURL=planner.test.js.map