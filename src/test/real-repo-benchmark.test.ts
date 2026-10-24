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

test("real-repository benchmark validates sparse checkout scope and never resumes changed paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-sparse-benchmark-"));
  const repo = path.join(root, "repo");
  const manifest = path.join(root, "manifest.json");
  const output = path.join(root, "report.json");
  try {
    await mkdir(path.join(repo, "src"), { recursive: true });
    await mkdir(path.join(repo, "other"));
    await writeFile(path.join(repo, "src", "agent.ts"), 'const model = "gpt-4o-mini-2024-07-18";\n');
    await writeFile(path.join(repo, "other", "service.ts"), 'const model = "gpt-4o-mini-2024-07-18";\n');
    execFileSync("git", ["init", "-q", repo]);
    execFileSync("git", ["-c", "core.autocrlf=false", "add", "."], { cwd: repo });
    execFileSync("git", ["-c", "user.name=ModelDeps Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"], { cwd: repo });
    execFileSync("git", ["sparse-checkout", "set", "--cone", "src"], { cwd: repo });
    await assert.rejects(readFile(path.join(repo, "other", "service.ts")), { code: "ENOENT" });
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
    const save = (sparse_paths?: string[]) => writeFile(manifest, JSON.stringify({ repositories: [{ name: "sparse-fixture", path: repo, commit, ...(sparse_paths ? { sparse_paths } : {}) }] }));
    const run = (...args: string[]) => spawnSync(process.execPath, [script, "--manifest", manifest, "--registry", registry, "--output", output, ...args], { encoding: "utf8" });
    await save(["src"]);
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    let report = JSON.parse(await readFile(output, "utf8"));
    assert.deepEqual(report.repositories[0].scan_config.sparse_paths, ["src"]);
    assert.equal(report.repositories[0].findings[0].file, "src/agent.ts");
    assert.deepEqual(JSON.parse(await readFile(`${output}.pins.json`, "utf8")).repositories[0].sparse_paths, ["src"]);
    assert.equal(run("--resume").status, 0);
    assert.equal(JSON.parse(await readFile(output, "utf8")).repositories[0].resumed, true);
    execFileSync("git", ["sparse-checkout", "set", "--cone", "other"], { cwd: repo });
    await save(["other"]);
    assert.equal(run("--resume").status, 0);
    report = JSON.parse(await readFile(output, "utf8"));
    assert.equal(report.repositories[0].resumed, false);
    assert.equal(report.repositories[0].findings[0].file, "other/service.ts");
    await save();
    assert.equal(run("--resume").status, 3);
    assert.match(JSON.parse(await readFile(output, "utf8")).repositories[0].reason, /declared sparse_paths/);
    await save(["../outside"]);
    assert.equal(run("--resume").status, 3);
    assert.match(JSON.parse(await readFile(output, "utf8")).repositories[0].reason, /safe repository-relative/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
