import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const cliPath = fileURLToPath(new URL("../cli.js", import.meta.url));
const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "modeldeps-cli-fixture-"));
const registryPath = path.join(fixtureRoot, "registry.fixture.json");
const fixture = JSON.parse(await readFile(fileURLToPath(new URL("../../demo/registry.fixture.json", import.meta.url)), "utf8"));
fixture.generated_at = new Date().toISOString();
for (const record of fixture.models) {
    for (const source of [record.source, record.replacement_source].filter(Boolean)) {
        assert.equal(source.kind, "fixture", "Only synthetic fixture observation times may be refreshed");
        source.observed_at = fixture.generated_at;
    }
}
await writeFile(registryPath, JSON.stringify(fixture));
after(() => rm(fixtureRoot, { recursive: true, force: true }));
function runCli(args) {
    return spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8", timeout: 20_000 });
}
test("CLI migration evidence binds eval results to plan and repository input hashes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-cli-evidence-"));
    try {
        await mkdir(path.join(root, "src"), { recursive: true });
        const sourcePath = path.join(root, "src", "agent.ts");
        const planPath = path.join(root, ".modeldeps", "plan.json");
        const evidencePath = path.join(root, ".modeldeps", "evidence.json");
        await writeFile(sourcePath, 'const model = "openai-demo-retired";\n', "utf8");
        const planRun = runCli(["plan", root, "--registry", registryPath, "--output", planPath]);
        assert.equal(planRun.status, 0, planRun.stderr);
        const plan = JSON.parse(await readFile(planPath, "utf8"));
        assert.equal(plan.repository_inputs.length, 1);
        assert.match(plan.repository_inputs[0].sha256, /^[a-f0-9]{64}$/);
        assert.match(plan.registry_sha256, /^[a-f0-9]{64}$/);
        const verifyRun = runCli(["verify", "--plan", planPath, "--registry", registryPath, "--command", 'node -e "process.exit(0)"', "--output", evidencePath]);
        assert.equal(verifyRun.status, 0, `${verifyRun.stdout}\n${verifyRun.stderr}`);
        const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
        assert.equal(evidence.passed, true);
        assert.equal(evidence.blocked, false);
        assert.match(evidence.plan_sha256, /^[a-f0-9]{64}$/);
        assert.equal(evidence.evaluation?.exit_code, 0);
        assert.match(evidence.evaluation?.stdout_sha256 ?? "", /^[a-f0-9]{64}$/);
        assert.equal(evidence.inputs[0]?.sha256, evidence.inputs[0]?.expected_sha256);
        assert.match(await readFile(`${evidencePath}.sha256`, "utf8"), /^[a-f0-9]{64}  evidence\.json\n$/);
        await writeFile(sourcePath, 'const model = "openai-demo-next";\n', "utf8");
        const staleRun = runCli(["verify", "--plan", planPath, "--registry", registryPath, "--command", 'node -e "process.exit(0)"', "--output", path.join(root, "stale-evidence.json")]);
        assert.equal(staleRun.status, 1);
        const staleEvidence = JSON.parse(await readFile(path.join(root, "stale-evidence.json"), "utf8"));
        assert.equal(staleEvidence.blocked, true);
        assert.match(staleEvidence.reason, /changed since plan generation/);
        assert.equal(staleEvidence.evaluation, undefined);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("--strict-stale fails a check when lifecycle evidence exceeds its age policy", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-strict-stale-"));
    try {
        const registryPath = path.join(root, "registry.json");
        await writeFile(registryPath, JSON.stringify({
            schema_version: "0.1",
            generated_at: "2020-01-01T00:00:00.000Z",
            models: [{
                    provider: "openai", surface: "openai-api", model_id: "gpt-old-fixture", status: "active",
                    recommended_replacements: [],
                    source: { kind: "fixture", url: "fixture://old", observed_at: "2020-01-01T00:00:00.000Z" }
                }]
        }), "utf8");
        const repo = path.join(root, "repo");
        await mkdir(repo, { recursive: true });
        const permissive = runCli(["check", repo, "--registry", registryPath]);
        assert.equal(permissive.status, 0, `${permissive.stdout}\n${permissive.stderr}`);
        const strict = runCli(["check", repo, "--registry", registryPath, "--strict-stale"]);
        assert.equal(strict.status, 1, `${strict.stdout}\n${strict.stderr}`);
        assert.match(strict.stderr, /evidence is stale/);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("verify and apply reject a hand-edited plan that weakens the evaluation gate", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-tampered-plan-"));
    try {
        await mkdir(path.join(root, "src"), { recursive: true });
        const sourcePath = path.join(root, "src", "agent.ts");
        const planPath = path.join(root, ".modeldeps", "plan.json");
        await writeFile(sourcePath, 'const model = "openai-demo-retired";\n', "utf8");
        const planRun = runCli(["plan", root, "--registry", registryPath, "--output", planPath]);
        assert.equal(planRun.status, 0, `${planRun.stdout}\n${planRun.stderr}`);
        const plan = JSON.parse(await readFile(planPath, "utf8"));
        assert.equal(plan.migrations[0]?.risk, "R3");
        assert.deepEqual(plan.migrations[0]?.required_gates, ["configured-eval"]);
        plan.migrations[0].risk = "R0";
        plan.migrations[0].required_gates = [];
        plan.migrations[0].autofixable = true;
        await writeFile(planPath, JSON.stringify(plan, null, 2) + "\n", "utf8");
        const verify = runCli(["verify", "--plan", planPath, "--registry", registryPath, "--command", 'node -e "process.exit(0)"', "--output", path.join(root, ".modeldeps", "tampered-evidence.json")]);
        assert.equal(verify.status, 1, `${verify.stdout}\n${verify.stderr}`);
        const tamperedEvidence = JSON.parse(await readFile(path.join(root, ".modeldeps", "tampered-evidence.json"), "utf8"));
        assert.match(tamperedEvidence.reason, /does not match the current repository and registry-derived policy|Plan SHA-256/);
        assert.equal(tamperedEvidence.passed, false);
        assert.equal(tamperedEvidence.evaluation, undefined);
        const apply = runCli(["apply", "--plan", planPath, "--registry", registryPath, "--root", root, "--write"]);
        assert.equal(apply.status, 1, `${apply.stdout}\n${apply.stderr}`);
        assert.match(apply.stdout, /does not match the current repository and registry-derived policy|Plan SHA-256/);
        assert.equal(await readFile(sourcePath, "utf8"), 'const model = "openai-demo-retired";\n');
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("scan and check both honor provider filters from configuration", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-provider-config-"));
    try {
        await mkdir(path.join(root, "src"), { recursive: true });
        await mkdir(path.join(root, ".modeldeps"), { recursive: true });
        await writeFile(path.join(root, "src", "agent.ts"), [
            'const a = client.create({ model: "openai-demo-retired" });',
            'const b = client.create({ model: "anthropic-demo-legacy" });',
            ''
        ].join("\n"), "utf8");
        const configPath = path.join(root, ".modeldeps", "config.json");
        await writeFile(configPath, JSON.stringify({ version: 1, providers: ["openai"], ignore: [], policy: {}, evaluations: {} }), "utf8");
        for (const command of ["scan", "check"]) {
            const result = runCli([command, root, "--registry", registryPath, "--config", configPath, "--format", "json"]);
            assert.equal(result.status, command === "scan" ? 0 : 1, `${command}: ${result.stdout}\n${result.stderr}`);
            const parsed = JSON.parse(result.stdout);
            assert.deepEqual(parsed.findings.map((finding) => finding.model_id), ["openai-demo-retired"]);
        }
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("verify blocks stale registry before executing eval", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-stale-gate-"));
    try {
        const registry = JSON.parse(await readFile(registryPath, "utf8"));
        registry.generated_at = "2020-01-01T00:00:00.000Z";
        const localRegistry = path.join(root, "registry.json");
        const plan = path.join(root, ".modeldeps", "plan.json");
        await writeFile(localRegistry, JSON.stringify(registry));
        await writeFile(path.join(root, "agent.ts"), 'const model = "openai-demo-retired";');
        assert.equal(runCli(["plan", root, "--registry", localRegistry, "--output", plan]).status, 0);
        const result = runCli(["verify", "--plan", plan, "--registry", localRegistry, "--command", 'node -e "process.exit(0)"']);
        assert.equal(result.status, 1);
        assert.match(result.stdout, /stale/);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("verify binds eval source and rejects eval mutating workspace", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-eval-input-"));
    try {
        const plan = path.join(root, ".modeldeps", "plan.json");
        const evalFile = path.join(root, "eval.cjs");
        await writeFile(path.join(root, "agent.ts"), 'const model = "openai-demo-retired";');
        await writeFile(evalFile, "process.exit(0)");
        assert.equal(runCli(["plan", root, "--registry", registryPath, "--output", plan]).status, 0);
        await writeFile(evalFile, "process.exit(1)");
        const changed = runCli(["verify", "--plan", plan, "--registry", registryPath, "--command", "node eval.cjs"]);
        assert.equal(changed.status, 1);
        assert.match(changed.stdout, /Workspace inputs changed/);
        await writeFile(evalFile, "require('node:fs').writeFileSync('new-input.txt','changed'); process.exit(0)");
        assert.equal(runCli(["plan", root, "--registry", registryPath, "--output", plan]).status, 0);
        const mutated = runCli(["verify", "--plan", plan, "--registry", registryPath, "--command", "node eval.cjs"]);
        assert.equal(mutated.status, 1);
        assert.match(mutated.stdout, /changed during evaluation/);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("provider source failure has exit 3 and preserves registry bytes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-source-failure-"));
    try {
        const preload = path.join(root, "mock.mjs");
        const output = path.join(root, "registry.json");
        const bytes = await readFile(registryPath);
        await writeFile(output, bytes);
        await writeFile(preload, 'globalThis.fetch = async () => new Response("unavailable", { status: 503 });');
        const result = spawnSync(process.execPath, ["--import", pathToFileURL(preload).href, cliPath, "registry", "sync", "--provider", "google", "--live", "--registry", output], { encoding: "utf8" });
        assert.equal(result.status, 3, result.stderr);
        assert.match(result.stderr, /HTTP 503/);
        assert.deepEqual(await readFile(output), bytes);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("verify rejects unofficial replacements and inactive targets before eval", async () => {
    for (const scenario of ["community", "inactive-target"]) {
        const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-source-gate-"));
        try {
            const localRegistry = path.join(root, "registry.json");
            const plan = path.join(root, ".modeldeps", "plan.json");
            const registry = JSON.parse(await readFile(registryPath, "utf8"));
            const source = registry.models.find((record) => record.model_id === "openai-demo-retired");
            const target = registry.models.find((record) => record.model_id === "openai-demo-next");
            if (scenario === "community")
                source.recommended_replacements[0].authority = "community";
            else
                target.status = "retired";
            await writeFile(localRegistry, JSON.stringify(registry));
            await writeFile(path.join(root, "agent.ts"), 'const model = "openai-demo-retired";');
            assert.equal(runCli(["plan", root, "--registry", localRegistry, "--output", plan]).status, 0);
            const result = runCli(["verify", "--plan", plan, "--registry", localRegistry, "--command", 'node -e "process.exit(0)"']);
            assert.equal(result.status, 1, result.stdout);
            assert.match(result.stdout, /Community migration|Target model/);
        }
        finally {
            await rm(root, { recursive: true, force: true });
        }
    }
});
test("verify rejects target evidence without a content hash and future observations", async () => {
    for (const scenario of ["target-hash", "future-observation"]) {
        const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-evidence-semantic-"));
        try {
            const localRegistry = path.join(root, "registry.json");
            const plan = path.join(root, ".modeldeps", "plan.json");
            const registry = JSON.parse(await readFile(registryPath, "utf8"));
            if (scenario === "future-observation")
                registry.generated_at = "2099-01-01T00:00:00Z";
            else {
                const target = registry.models.find((r) => r.model_id === "openai-demo-next");
                target.source = { kind: "official", url: "https://api.openai.com/v1/models", observed_at: new Date().toISOString() };
            }
            await writeFile(localRegistry, JSON.stringify(registry));
            await writeFile(path.join(root, "agent.ts"), 'const model = "openai-demo-retired";');
            assert.equal(runCli(["plan", root, "--registry", localRegistry, "--output", plan]).status, 0);
            const verify = runCli(["verify", "--plan", plan, "--registry", localRegistry, "--command", 'node -e "process.exit(0)"']);
            assert.equal(verify.status, 1, verify.stdout);
            assert.match(verify.stdout, /missing its content|future observation/);
        }
        finally {
            await rm(root, { recursive: true, force: true });
        }
    }
});
//# sourceMappingURL=cli-evidence.test.js.map