import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { importReviewedSnapshot } from "../providers/reviewed-snapshot.js";

test("imports a reviewed snapshot with official provenance and digest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-snapshot-"));
  const file = path.join(root, "snapshot.json");
  try {
    await writeFile(file, JSON.stringify({
      provider: "anthropic",
      surface: "anthropic-api",
      source_url: "https://docs.anthropic.com/en/docs/about-claude/model-deprecations",
      observed_at: "2026-10-23T00:00:00.000Z",
      models: [{ model_id: "claude-demo-model", status: "deprecated", shutdown_at: "2026-12-01", recommended_replacements: [] }]
    }), "utf8");
    const imported = await importReviewedSnapshot(file, "anthropic");
    assert.equal(imported.models.length, 1);
    assert.equal(imported.models[0]?.source.kind, "official");
    assert.equal(imported.models[0]?.source.evidence_mode, "reviewed-snapshot");
    assert.equal(imported.models[0]?.source.sha256, undefined);
    assert.match(imported.models[0]?.source.snapshot_sha256 ?? "", /^[a-f0-9]{64}$/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects snapshot URLs outside provider-owned hosts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-snapshot-host-"));
  const file = path.join(root, "snapshot.json");
  try {
    await writeFile(file, JSON.stringify({
      provider: "google",
      source_url: "https://example.com/gemini-deprecations",
      observed_at: "2026-10-23T00:00:00.000Z",
      models: []
    }), "utf8");
    await assert.rejects(importReviewedSnapshot(file, "google"), /official google host/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("preserves provider-specific earliest-possible date semantics in reviewed snapshots", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-snapshot-date-kind-"));
  const file = path.join(root, "snapshot.json");
  try {
    await writeFile(file, JSON.stringify({
      provider: "google",
      surface: "gemini-api",
      source_url: "https://ai.google.dev/gemini-api/docs/deprecations",
      observed_at: "2026-10-23T00:00:00.000Z",
      shutdown_date_kind: "earliest-possible",
      models: [{ model_id: "gemini-date-kind-test", status: "deprecated", shutdown_at: "2026-10-01", recommended_replacements: [] }]
    }), "utf8");
    const imported = await importReviewedSnapshot(file, "google");
    assert.equal(imported.models[0]?.shutdown_date_kind, "earliest-possible");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
