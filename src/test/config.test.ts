import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { mergeConfig, parseYamlSubset } from "../config.js";

const configPath = fileURLToPath(new URL("../../.modeldeps.yml", import.meta.url));

test("parses the documented YAML subset used by the sample config", async () => {
  const parsed = parseYamlSubset(await readFile(configPath, "utf8")) as Record<string, unknown>;
  assert.equal(parsed.version, 1);
  assert.deepEqual(parsed.providers, ["openai", "anthropic", "google"]);
  const policy = parsed.policy as Record<string, unknown>;
  assert.equal(policy.fail_days_before_shutdown, 30);
  const evaluations = parsed.evaluations as Record<string, unknown>;
  assert.ok(evaluations.default);
});

test("rejects unsupported YAML features rather than silently misreading them", () => {
  assert.throws(() => parseYamlSubset("config: &anchor value\n"), /Unsupported YAML syntax/);
});


test("rejects fractional or negative policy day thresholds and invalid eval timeouts", () => {
  assert.throws(() => mergeConfig(parseYamlSubset("policy:\n  max_source_age_days: 1.5\n")), /non-negative integers/);
  assert.throws(() => mergeConfig(parseYamlSubset("evaluations:\n  default:\n    timeout_seconds: 0\n")), /positive integer/);
  assert.throws(() => mergeConfig(parseYamlSubset("policy:\n  require_eval_on: 42\n")), /list of non-empty change names/);
});


test("configuration rejects wrong scalar types instead of silently defaulting", () => {
  assert.throws(() => mergeConfig({ policy: { max_source_age_days: "30" } }), /must be a number/);
  assert.throws(() => mergeConfig({ policy: { fail_on_unknown: "true" } }), /must be boolean/);
  assert.throws(() => mergeConfig({ evaluations: { default: { command: 42 } } }), /non-empty string/);
});
