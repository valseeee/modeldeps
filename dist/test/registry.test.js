import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateRegistry } from "../registry.js";
const fixturePath = fileURLToPath(new URL("../../demo/registry.fixture.json", import.meta.url));
test("validates the deterministic demo registry", async () => {
    const raw = JSON.parse(await readFile(fixturePath, "utf8"));
    const registry = validateRegistry(raw);
    assert.equal(registry.models.length, 5);
    assert.equal(registry.models[0]?.source.kind, "fixture");
});
test("rejects official records without an HTTPS source", () => {
    assert.throws(() => validateRegistry({
        schema_version: "0.1",
        generated_at: "2026-10-23T00:00:00.000Z",
        models: [{
                provider: "openai", surface: "openai-api", model_id: "gpt-example", status: "retired",
                recommended_replacements: [], source: { kind: "official", url: "fixture://nope", observed_at: "2026-10-23T00:00:00.000Z" }
            }]
    }), /HTTPS URL/);
});
test("rejects duplicate canonical identities", () => {
    const record = {
        provider: "openai", surface: "openai-api", model_id: "gpt-example", status: "active",
        recommended_replacements: [], source: { kind: "fixture", url: "fixture://test", observed_at: "2026-10-23T00:00:00.000Z" }
    };
    assert.throws(() => validateRegistry({ schema_version: "0.1", generated_at: "2026-10-23T00:00:00.000Z", models: [record, record] }), /Duplicate registry identity/);
});
//# sourceMappingURL=registry.test.js.map