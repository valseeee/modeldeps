import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../../scripts/prepare-benchmark-review.mjs", import.meta.url));
test("review packs preserve exact scope and model identity without claiming human labels", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-review-pack-"));
    try {
        const input = path.join(root, "report.json");
        const output = path.join(root, "review");
        const commit = "a".repeat(40);
        await writeFile(input, JSON.stringify({ configuration: { implementation_sha256: "b".repeat(64) }, repositories: [{ name: "owner/repo", commit, status: "scanned", labeled: true, scan_config: { ignore: ["src/mocks/**"], sparse_paths: ["src"] }, findings: [{ file: "src/agent.ts", line: 2, column: 3, provider: "unknown", surface: "unknown", model_id: "=1+1", context: 'a,"quoted" context' }] }] }));
        const run = () => spawnSync(process.execPath, [script, "--output", output, input], { encoding: "utf8" });
        const result = run();
        assert.equal(result.status, 0, result.stderr);
        const json = JSON.parse(await readFile(path.join(output, "review-template.json"), "utf8"));
        assert.equal(json.repositories[0].reviewed, false);
        assert.deepEqual(json.repositories[0].sparse_paths, ["src"]);
        assert.deepEqual(json.repositories[0].ignore, ["src/mocks/**"]);
        assert.equal(json.repositories[0].expected_findings[0].model_id, "=1+1");
        const csv = await readFile(path.join(output, "candidates.csv"), "utf8");
        assert.ok(csv.startsWith("\ufeff"));
        assert.ok(csv.includes('"\'=1+1"'));
        assert.ok(csv.includes('a,""quoted"" context'));
        assert.ok(csv.includes(`/blob/${commit}/src/agent.ts#L2`));
        const summary = JSON.parse(await readFile(path.join(output, "review-progress.json"), "utf8"));
        assert.equal(summary.human_reviewed, 0);
        assert.equal(summary.gold_ready, false);
        assert.equal(summary.metrics, null);
        assert.equal(summary.review_progress[0].independent_missed_reference_search_completed, false);
        assert.notEqual(run().status, 0, "must not overwrite a review in progress");
        assert.equal(JSON.parse(await readFile(path.join(output, "review-template.json"), "utf8")).repositories[0].reviewed, false);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
//# sourceMappingURL=review-pack.test.js.map