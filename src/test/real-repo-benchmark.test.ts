import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const script = path.join(projectRoot, "scripts", "benchmark-real-repos.mjs");
const registry = path.join(projectRoot, "data", "registry.json");

test("real-repository benchmark records exact commit and scores only reviewed labels", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-real-repo-benchmark-"));
  const repo = path.join(root, "fixture-repo");
  const manifest = path.join(root, "manifest.json");
  const output = path.join(root, "report.json");
  const template = path.join(root, "template.json");
  try {
    await mkdir(path.join(repo, "src"), { recursive: true });
    execFileSync("git", ["init", "-q", repo]);
    execFileSync("git", ["config", "user.email", "test@example.invalid"], { cwd: repo });
    execFileSync("git", ["config", "user.name", "ModelDeps Test"], { cwd: repo });
    await writeFile(path.join(repo, "src", "agent.ts"), 'export const model = "gpt-4o-mini-2024-07-18";\n', "utf8");
    execFileSync("git", ["add", "src/agent.ts"], { cwd: repo });
    execFileSync("git", ["commit", "-qm", "fixture"], { cwd: repo });
    await writeFile(manifest, JSON.stringify({ repositories: [{ name: "local-fixture", path: repo, reviewed: true, commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), expected_findings: [{ file: "src/agent.ts", line: 1, column: 23, provider: "openai", surface: "openai-api", model_id: "gpt-4o-mini-2024-07-18" }] }] }), "utf8");
    const result = spawnSync(process.execPath, [script, "--manifest", manifest, "--registry", registry, "--output", output, "--write-template", template], { cwd: projectRoot, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(await readFile(output, "utf8")) as { mode: string; repositories: Array<{ commit: string; score?: { tp: number; fp: number; fn: number } }>; aggregate?: { precision: number; recall: number } };
    assert.equal(report.mode, "scored");
    assert.match(report.repositories[0]?.commit ?? "", /^[a-f0-9]{40}$/);
    assert.deepEqual(report.repositories[0]?.score, { tp: 1, fp: 0, fn: 0, precision: 1, recall: 1, f1: 1, false_positives: [], false_negatives: [] });
    assert.equal(report.aggregate?.precision, 1);
    assert.equal(report.aggregate?.recall, 1);
    const generated = JSON.parse(await readFile(template, "utf8")) as { repositories: Array<{ commit: string; expected_findings: unknown[] }> };
    assert.match(generated.repositories[0]?.commit ?? "", /^[a-f0-9]{40}$/);
    assert.equal(generated.repositories[0]?.expected_findings.length, 1);
    const duplicate = spawnSync(process.execPath, [script, "--manifest", manifest, "--output", output], { encoding: "utf8" });
    assert.notEqual(duplicate.status, 0);
    const resumed = spawnSync(process.execPath, [script, "--manifest", manifest, "--registry", registry, "--output", output, "--resume"], { encoding: "utf8" });
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal(JSON.parse(await readFile(output, "utf8")).repositories[0].resumed, true);
    await writeFile(manifest, JSON.stringify({ repositories: [{ name: "local-fixture", path: repo, commit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim(), reviewed: true, ignore: ["src/**"], expected_findings: [] }] }));
    const scoped = spawnSync(process.execPath, [script, "--manifest", manifest, "--registry", registry, "--output", output, "--resume"], { encoding: "utf8" });
    assert.equal(scoped.status, 0, scoped.stderr);
    const scopedReport = JSON.parse(await readFile(output, "utf8"));
    assert.equal(scopedReport.repositories[0].resumed, false);
    assert.deepEqual(scopedReport.repositories[0].scan_config.ignore, ["src/**"]);
    assert.equal(scopedReport.repositories[0].findings.length, 0);
    assert.equal(scopedReport.aggregate.precision, null);


  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
