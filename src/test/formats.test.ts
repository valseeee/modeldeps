import test from "node:test";
import assert from "node:assert/strict";
import { toSarif } from "../formats.js";
import { checkModels } from "../policy.js";
import { loadRegistry } from "../registry.js";
import { DEFAULT_POLICY, type ModelFinding } from "../types.js";
import { fileURLToPath } from "node:url";

const registryPath = fileURLToPath(new URL("../../demo/registry.fixture.json", import.meta.url));

test("emits a SARIF 2.1.0 document with source locations", async () => {
  const registry = await loadRegistry(registryPath);
  const finding: ModelFinding = {
    provider: "openai", surface: "openai-api", model_id: "openai-demo-retired",
    file: "src/agent.ts", line: 3, column: 22, confidence: 0.99, evidence: 'model = "openai-demo-retired"'
  };
  const checked = checkModels([finding], registry, DEFAULT_POLICY, "/repo", new Date("2026-10-23T00:00:00.000Z"));
  const sarif = toSarif(checked) as { version: string; runs: Array<{ results: Array<{ locations: Array<{ physicalLocation: { region: { startLine: number } } }> }> }> };
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0]?.results[0]?.locations[0]?.physicalLocation.region.startLine, 3);
});
