import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { scanRepository } from "../scanner.js";
import { loadRegistry } from "../registry.js";
import { fileURLToPath } from "node:url";
const registryPath = fileURLToPath(new URL("../../demo/registry.fixture.json", import.meta.url));
test("scans known model references in source and structured config", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-scanner-"));
    try {
        await mkdir(path.join(root, "src"), { recursive: true });
        await writeFile(path.join(root, "src", "agent.ts"), 'const model = "openai-demo-retired";\n', "utf8");
        await writeFile(path.join(root, "settings.yaml"), 'model: "anthropic-demo-legacy"\n', "utf8");
        await writeFile(path.join(root, "README.md"), 'model: "openai-demo-retired"\n', "utf8");
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.equal(findings.length, 2);
        assert.deepEqual(findings.map((item) => item.model_id).sort(), ["anthropic-demo-legacy", "openai-demo-retired"]);
        const openaiOnly = await scanRepository(root, registry, { providers: ["openai"] });
        assert.deepEqual(openaiOnly.map((item) => item.model_id), ["openai-demo-retired"]);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("reports generic model assignment even when lifecycle is unknown", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-unknown-"));
    try {
        await writeFile(path.join(root, "agent.py"), 'client = make_client(model="custom-internal-model")\n', "utf8");
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.equal(findings.length, 1);
        assert.equal(findings[0]?.provider, "unknown");
        assert.equal(findings[0]?.model_id, "custom-internal-model");
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("does not report model IDs in unrelated strings or comments", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-false-positive-"));
    try {
        await writeFile(path.join(root, "agent.ts"), [
            'const message = "gpt-5.4-cyber is scheduled to retire";',
            '// const model = "gpt-5.4-cyber";',
            'const result = run({ model: "gpt-5.4-cyber" }); // expected dependency',
            ''
        ].join("\n"), "utf8");
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.deepEqual(findings.map((item) => item.model_id), ["gpt-5.4-cyber"]);
        assert.equal(findings[0]?.line, 3);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("refuses to choose between deployment surfaces sharing a model ID", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-ambiguous-surface-"));
    try {
        await writeFile(path.join(root, "agent.py"), 'client.create(model="claude-surface-test")\n', "utf8");
        const registry = {
            schema_version: "0.1",
            generated_at: "2026-10-22T22:49:00.000Z",
            models: [
                { provider: "anthropic", surface: "anthropic-api", model_id: "claude-surface-test", status: "active", recommended_replacements: [], source: { kind: "fixture", url: "fixture://test/api", observed_at: "2026-10-22T22:49:00.000Z" } },
                { provider: "anthropic", surface: "bedrock", model_id: "claude-surface-test", status: "retired", recommended_replacements: [], source: { kind: "fixture", url: "fixture://test/bedrock", observed_at: "2026-10-22T22:49:00.000Z" } }
            ]
        };
        const findings = await scanRepository(root, registry);
        assert.equal(findings.length, 1);
        assert.equal(findings[0]?.surface, "unknown");
        assert.equal(findings[0]?.resolution, "ambiguous-surface");
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("does not report model configuration examples embedded inside string literals", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-string-example-"));
    try {
        await writeFile(path.join(root, "docs.ts"), [
            `const sample = '{"model": "gpt-5.4-cyber"}';`,
            `const escaped = "{\\"model\\": \\"gpt-5.4-cyber\\"}";`,
            `const envExample = "OPENAI_MODEL=gpt-5.4-cyber";`,
            `const templateExample = \`model: "gpt-5.4-cyber"\`;`,
            ''
        ].join("\n"), "utf8");
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.deepEqual(findings, []);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("still reports quoted keys in real JSON and JavaScript object literals", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-quoted-key-"));
    try {
        await writeFile(path.join(root, "settings.json"), '{"model": "gpt-5.4-cyber"}\n', "utf8");
        await writeFile(path.join(root, "agent.js"), 'client.create({ "model": "claude-opus-4-1-20250805" });\n', "utf8");
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.deepEqual(findings.map((finding) => finding.model_id).sort(), ["claude-opus-4-1-20250805", "gpt-5.4-cyber"]);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("ignores generated ModelDeps evidence and plan artifacts by default", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-ignore-evidence-"));
    try {
        await mkdir(path.join(root, ".modeldeps"), { recursive: true });
        await writeFile(path.join(root, ".modeldeps", "plan.json"), JSON.stringify({ model_id: "openai-demo-retired", to: { model_id: "openai-demo-next" } }), "utf8");
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.deepEqual(findings, []);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("inline block comments preserve source columns and scan budgets fail closed", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-columns-"));
    try {
        const source = '/* context */ const model = "gpt-4o";';
        await writeFile(path.join(root, "agent.ts"), source);
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.equal(findings[0]?.column, source.indexOf("gpt-4o") + 1);
        await assert.rejects(scanRepository(root, registry, { maxBytes: 2 }), /budget/);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("long non-model tokens do not hide subsequent dependencies or cause unbounded key matching", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-long-token-"));
    try {
        await writeFile(path.join(root, "agent.ts"), 'const ' + 'x'.repeat(100000) + ' = "value";\nconst model = "gpt-4o";');
        const findings = await scanRepository(root, await loadRegistry(registryPath));
        assert.equal(findings.length, 1);
        assert.equal(findings[0]?.model_id, "gpt-4o");
        assert.equal(findings[0]?.line, 2);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("quoted templates remain dynamic and quoted punctuation is not silently stripped", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-literals-"));
    try {
        await writeFile(path.join(root, "agent.ts"), 'const model = `gpt-${variant}`;\nconst model_id = "gpt-4o,";');
        const findings = await scanRepository(root, await loadRegistry(registryPath));
        assert.deepEqual(findings.map(f => f.model_id), ["gpt-4o,"]);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("batched I/O keeps deterministic findings and closes pending reads before budget failure", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-batched-io-"));
    try {
        const names = Array.from({ length: 16 }, (_, index) => `${String(index).padStart(2, "0")}.ts`);
        await Promise.all(names.map(name => writeFile(path.join(root, name), 'const model = "gpt-4o";')));
        const registry = await loadRegistry(registryPath);
        const findings = await scanRepository(root, registry);
        assert.deepEqual(findings.map(f => f.file), names);
        await assert.rejects(scanRepository(root, registry, { maxBytes: 30 }), /budget/);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("quoted whitespace is part of model identity and cannot resolve as an exact registry match", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-exact-literal-"));
    try {
        await writeFile(path.join(root, "agent.ts"), 'const model = " openai-demo-retired ";');
        const findings = await scanRepository(root, await loadRegistry(registryPath));
        assert.equal(findings[0]?.model_id, " openai-demo-retired ");
        assert.notEqual(findings[0]?.resolution, "registry-exact");
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=scanner.test.js.map