import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyMigrationPlan } from "../planner.js";
import type { MigrationPlan, RegistrySnapshot } from "../types.js";

function createRegistry(): RegistrySnapshot {
  return {
    schema_version: "0.1", generated_at: "2026-10-23T00:00:00.000Z",
    models: [
      {
        provider: "openai", surface: "openai-api", model_id: "gpt-old", status: "deprecated",
        recommended_replacements: [{ model_id: "gpt-new", authority: "provider", risk: "R0", changes: [] }],
        source: { kind: "official", url: "https://api.openai.com/v1/models", observed_at: "2026-10-23T00:00:00.000Z" }
      },
      {
        provider: "openai", surface: "openai-api", model_id: "gpt-new", status: "active",
        recommended_replacements: [],
        source: { kind: "official", url: "https://api.openai.com/v1/models", observed_at: "2026-10-23T00:00:00.000Z" }
      }
    ]
  };
}

function createPlan(root: string): MigrationPlan {
  return {
    schema_version: "0.2", generated_at: "2026-10-23T00:00:00.000Z", root,
    migrations: [{
      from: { provider: "openai", surface: "openai-api", model_id: "gpt-old" },
      to: { provider: "openai", surface: "openai-api", model_id: "gpt-new" },
      authority: "provider", risk: "R0", changes: [], required_gates: [], autofixable: true,
      occurrences: [{ file: "src/agent.ts", line: 1, column: 16 }],
      source: { kind: "official", url: "https://api.openai.com/v1/models", observed_at: "2026-10-23T00:00:00.000Z" },
      lifecycle_source: { kind: "official", url: "https://api.openai.com/v1/models", observed_at: "2026-10-23T00:00:00.000Z" }
    }], notes: []
  };
}

test("apply is a dry run unless write is explicitly requested", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-apply-"));
  try {
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(root, "src"), { recursive: true }));
    const file = path.join(root, "src", "agent.ts");
    await writeFile(file, 'const model = "gpt-old";\n', "utf8");
    const plan = createPlan(root);
    const registry = createRegistry();
    const dryRun = await applyMigrationPlan(plan, root, false, registry);
    assert.equal(dryRun.dry_run, true);
    assert.equal(await readFile(file, "utf8"), 'const model = "gpt-old";\n');
    const applied = await applyMigrationPlan(plan, root, true, registry);
    assert.equal(applied.applied, true);
    assert.equal(await readFile(file, "utf8"), 'const model = "gpt-new";\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("preserves CRLF line endings when applying an exact edit", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-apply-crlf-"));
  try {
    await mkdir(path.join(root, "src"), { recursive: true });
    const file = path.join(root, "src", "agent.ts");
    const original = 'const model = "gpt-old";\r\nconst keep = true;\r\n';
    await writeFile(file, original, "utf8");
    const result = await applyMigrationPlan(createPlan(root), root, true, createRegistry());
    assert.equal(result.applied, true);
    assert.equal(await readFile(file, "utf8"), 'const model = "gpt-new";\r\nconst keep = true;\r\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("blocks migration edits through a symlinked parent directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-apply-symlink-root-"));
  const outside = await mkdtemp(path.join(os.tmpdir(), "modeldeps-apply-symlink-outside-"));
  try {
    const outsideFile = path.join(outside, "agent.ts");
    await writeFile(outsideFile, 'const model = "gpt-old";\n', "utf8");
    await symlink(outside, path.join(root, "src"), process.platform === "win32" ? "junction" : "dir");
    const result = await applyMigrationPlan(createPlan(root), root, true, createRegistry());
    assert.equal(result.applied, false);
    assert.ok(result.blocked.some((reason) => /symbolic links are not allowed/i.test(reason)));
    assert.equal(await readFile(outsideFile, "utf8"), 'const model = "gpt-old";\n');
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});


test("patch preserves mixed newlines and refuses UTF-16 input", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-encoding-"));
  try {
    await mkdir(path.join(root, "src"));
    const file = path.join(root, "src", "agent.ts");
    await writeFile(file, 'const model = "gpt-old";\r\nconst other = 1;\n');
    const result = await applyMigrationPlan(createPlan(root), root, true, createRegistry());
    assert.equal(result.applied, true);
    assert.equal(await readFile(file, "utf8"), 'const model = "gpt-new";\r\nconst other = 1;\n');
    const utf16 = Buffer.from('const model = "gpt-old";', "utf16le");
    await writeFile(file, utf16);
    const refused = await applyMigrationPlan(createPlan(root), root, true, createRegistry());
    assert.equal(refused.applied, false);
    assert.deepEqual(await readFile(file), utf16);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("patch preserves UTF-8 BOM and rejects read-only files", async () => {
  const fs = await import("node:fs/promises");
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-bom-"));
  const file = path.join(root, "src", "agent.ts");
  try {
    await mkdir(path.join(root, "src"));
    await writeFile(file, '\ufeffconst model = "gpt-old";\r\n');
    const plan = createPlan(root);
    plan.migrations[0]!.occurrences[0]!.column++;
    assert.equal((await applyMigrationPlan(plan, root, true, createRegistry())).applied, true);
    assert.equal(await readFile(file, "utf8"), '\ufeffconst model = "gpt-new";\r\n');
    await writeFile(file, 'const model = "gpt-old";\n');
    await fs.chmod(file, 0o444);
    const result = await applyMigrationPlan(createPlan(root), root, true, createRegistry());
    assert.equal(result.applied, false);
    assert.ok(result.blocked.some(message => /read-only/.test(message)));
  } finally { await fs.chmod(file, 0o644).catch(() => {}); await rm(root, { recursive: true, force: true }); }
});
