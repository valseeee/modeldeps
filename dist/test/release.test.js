import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../../scripts/release-version.mjs", import.meta.url));
const releaseTag = `v${JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")).version}`;
test("release preparation accepts an exact version tag and emits the artifact version", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-release-tag-"));
    try {
        const output = path.join(root, "output");
        const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "push", GITHUB_REF_TYPE: "tag", GITHUB_REF_NAME: releaseTag, GITHUB_OUTPUT: output } });
        assert.equal(result.status, 0, result.stderr);
        assert.equal(await readFile(output, "utf8"), `tag=${releaseTag}\n`);
    }
    finally {
        await rm(root, { recursive: true, force: true });
    }
});
test("release preparation rejects a mismatched tag, a branch push and an unsupported event", () => {
    for (const [event, type, ref] of [["push", "tag", "v9.9.9"], ["push", "branch", releaseTag], ["pull_request", "branch", "main"]]) {
        const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: event, GITHUB_REF_TYPE: type, GITHUB_REF_NAME: ref, GITHUB_OUTPUT: "" } });
        assert.notEqual(result.status, 0);
    }
});
test("manual release preparation uses the package version without requiring a tag", () => {
    const result = spawnSync(process.execPath, [script], { encoding: "utf8", env: { ...process.env, GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF_TYPE: "branch", GITHUB_REF_NAME: "main", GITHUB_OUTPUT: "" } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /manual preparation only/);
});
//# sourceMappingURL=release.test.js.map