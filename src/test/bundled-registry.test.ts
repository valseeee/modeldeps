import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadRegistry } from "../registry.js";
import { sha256 } from "../util.js";

const registryPath = fileURLToPath(new URL("../../data/registry.json", import.meta.url));
const snapshotsDir = fileURLToPath(new URL("../../data/snapshots/", import.meta.url));

test("registry contains provenance-validated lifecycle facts for all three providers", async () => {
  const registry = await loadRegistry(registryPath);
  assert.ok(registry.models.length >= 100, `expected a useful lifecycle registry, got ${registry.models.length}`);
  for (const provider of ["openai", "anthropic", "google"] as const) {
    const records = registry.models.filter((record) => record.provider === provider);
    assert.ok(records.length >= 10, `${provider} should have a useful lifecycle sample`);
    for (const record of records) {
      assert.equal(record.source.kind, "official");
      assert.match(record.source.url ?? "", /^https:\/\//);
      assert.ok(record.source.observed_at);
      if (record.source.evidence_mode === "reviewed-snapshot") {
        assert.match(record.source.snapshot_sha256 ?? "", /^[a-f0-9]{64}$/);
      } else if (record.source.evidence_mode === "api-response" || record.source.evidence_mode === "live-page") {
        assert.match(record.source.sha256 ?? "", /^[a-f0-9]{64}$/);
      } else {
        assert.fail(`${provider}/${record.model_id} has unsupported evidence mode ${record.source.evidence_mode}`);
      }
    }
  }
});

test("reviewed-snapshot provenance digests match the exact reviewed JSON artifact", async () => {
  const registry = await loadRegistry(registryPath);
  for (const provider of ["openai", "anthropic", "google"] as const) {
    const raw = await readFile(path.join(snapshotsDir, `${provider}.json`));
    const expected = sha256(raw);
    const records = registry.models.filter((record) => record.provider === provider && record.source.evidence_mode === "reviewed-snapshot");
    for (const record of records) assert.equal(record.source.snapshot_sha256, expected, `${provider}/${record.model_id}`);
  }
});

test("preserves provider-specific shutdown date semantics", async () => {
  const registry = await loadRegistry(registryPath);
  for (const record of registry.models.filter((model) => model.provider === "google" && model.shutdown_at)) {
    assert.equal(record.shutdown_date_kind, "earliest-possible", `${record.model_id} must preserve Google's date semantics`);
    assert.equal(record.announced_at, undefined, `${record.model_id}: release date must not be mislabeled as a deprecation announcement`);
  }
  for (const record of registry.models.filter((model) => model.provider === "openai" && model.shutdown_at)) {
    assert.equal(record.shutdown_date_kind, "confirmed", `${record.model_id} OpenAI API dates are confirmed by the API field`);
  }
  for (const record of registry.models.filter((model) => model.provider === "anthropic" && model.shutdown_at)) {
    assert.ok(["confirmed", "tentative"].includes(record.shutdown_date_kind ?? ""), `${record.model_id} must preserve the evidence's date certainty`);
  }
  const snapshot = JSON.parse(await readFile(path.join(snapshotsDir, "anthropic.json"), "utf8")) as { models: Array<{ model_id: string; shutdown_at?: string; recommended_replacements?: unknown[] }> };
  const mythosPreview = snapshot.models.find((model) => model.model_id === "claude-mythos-preview");
  assert.ok(mythosPreview);
  assert.equal(mythosPreview.shutdown_at, undefined);
  assert.equal(mythosPreview.recommended_replacements?.length ?? 0, 0, "the bundled reviewed snapshot must not invent an unlisted replacement");
});
