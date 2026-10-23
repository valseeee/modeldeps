import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm, rename, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { transactionalWrite } from "../transaction.js";

test("multi-file patch rolls back when second installation fails", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-rollback-"));
  try {
    const files = [path.join(root, "a.ts"), path.join(root, "b.ts")];
    await Promise.all(files.map(f => writeFile(f, "original")));
    let count = 0;
    await assert.rejects(transactionalWrite(files.map(file => ({ file, original: Buffer.from("original"), content: "changed" })), async (from, to) => {
      if (++count === 2) throw new Error("simulated disk failure");
      await rename(from, to);
    }), /original files restored/);
    for (const file of files) assert.equal(await readFile(file, "utf8"), "original");
    assert.deepEqual((await readdir(root)).sort(), ["a.ts", "b.ts"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("successful transaction cleans staged files and backups", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "modeldeps-transaction-"));
  try {
    const file = path.join(root, "a.ts");
    await writeFile(file, "original");
    await transactionalWrite([{ file, original: Buffer.from("original"), content: "changed" }]);
    assert.equal(await readFile(file, "utf8"), "changed");
    assert.deepEqual(await readdir(root), ["a.ts"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
