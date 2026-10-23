import test from "node:test";
import assert from "node:assert/strict";
import { checkExitCode, checkModels } from "../policy.js";
import { loadRegistry } from "../registry.js";
import { DEFAULT_POLICY } from "../types.js";
import { fileURLToPath } from "node:url";
const registryPath = fileURLToPath(new URL("../../demo/registry.fixture.json", import.meta.url));
function finding(model_id, provider, surface) {
    return { model_id, provider, surface, file: "src/agent.ts", line: 1, column: 15, confidence: 0.99, evidence: `model = "${model_id}"` };
}
test("fails a retired model and imminent shutdown according to policy", async () => {
    const registry = await loadRegistry(registryPath);
    const findings = [finding("openai-demo-retired", "openai", "openai-api"), finding("anthropic-demo-legacy", "anthropic", "anthropic-api")];
    const result = checkModels(findings, registry, DEFAULT_POLICY, "/repo", new Date("2026-10-23T12:00:00.000Z"));
    assert.ok(result.diagnostics.some((item) => item.code === "MODEL_RETIRED" && item.severity === "error"));
    assert.ok(result.diagnostics.some((item) => item.code === "MODEL_SHUTDOWN_IMMINENT" && item.days_to_shutdown === 28));
    assert.equal(checkExitCode(result), 1);
});
test("unknown models do not fail unless strict unknown is enabled", async () => {
    const registry = await loadRegistry(registryPath);
    const result = checkModels([finding("custom-model", "unknown", "unknown")], registry, DEFAULT_POLICY, "/repo");
    assert.equal(result.summary.unknown, 1);
    assert.equal(checkExitCode(result), 0);
    const strict = checkModels([finding("custom-model", "unknown", "unknown")], registry, { ...DEFAULT_POLICY, fail_on_unknown: true }, "/repo");
    assert.equal(checkExitCode(strict), 1);
});
test("warns when individual lifecycle evidence is stale even if the snapshot is present", async () => {
    const registry = await loadRegistry(registryPath);
    const result = checkModels([finding("openai-demo-retired", "openai", "openai-api")], registry, DEFAULT_POLICY, "/repo", new Date("2026-12-01T00:00:00.000Z"));
    assert.ok(result.diagnostics.some((item) => item.code === "MODEL_SOURCE_STALE" && item.severity === "warning"));
    assert.equal(result.registry.stale_source_records, registry.models.length);
});
test("does not treat a passed earliest-possible shutdown date as confirmed retirement", async () => {
    const registry = {
        schema_version: "0.1",
        generated_at: "2026-10-22T22:00:00.000Z",
        models: [{
                provider: "google",
                surface: "gemini-api",
                model_id: "gemini-earliest-date-test",
                status: "deprecated",
                shutdown_at: "2026-10-01",
                shutdown_date_kind: "earliest-possible",
                recommended_replacements: [],
                source: { kind: "fixture", url: "fixture://google/earliest-date", observed_at: "2026-10-22T22:00:00.000Z" }
            }]
    };
    const result = checkModels([finding("gemini-earliest-date-test", "google", "gemini-api")], registry, DEFAULT_POLICY, "/repo", new Date("2026-10-23T12:00:00.000Z"));
    const earliest = result.diagnostics.find((item) => item.code === "MODEL_EARLIEST_SHUTDOWN_DATE_PASSED");
    assert.equal(earliest?.severity, "warning");
    assert.equal(earliest?.shutdown_date_kind, "earliest-possible");
    assert.equal(checkExitCode(result), 0);
});
test("treats an empty registry as stale for strict lifecycle enforcement", () => {
    const registry = { schema_version: "0.1", generated_at: "2026-10-23T00:00:00.000Z", models: [] };
    const result = checkModels([], registry, DEFAULT_POLICY, "/repo", new Date("2026-10-23T12:00:00.000Z"));
    assert.equal(result.registry.empty, true);
    assert.equal(result.registry.stale, true);
});
//# sourceMappingURL=policy.test.js.map