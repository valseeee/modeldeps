import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
/** Stage all writes, retain originals, and roll back installed files on an I/O failure.
 * This is process-level rollback, not crash-atomicity across multiple files.
 */
export async function transactionalWrite(changes, install = fs.rename) {
    let recoveryNeeded = false;
    const staged = [];
    try {
        for (const change of changes) {
            const suffix = randomUUID();
            const entry = { file: change.file, temporary: `${change.file}.${suffix}.tmp`, backup: `${change.file}.${suffix}.backup`, installed: false };
            staged.push(entry);
            const mode = (await fs.stat(change.file)).mode;
            await fs.writeFile(entry.backup, change.original, { flag: "wx", mode });
            await fs.writeFile(entry.temporary, change.content, { flag: "wx", mode });
        }
        for (const entry of staged) {
            const change = changes.find(c => c.file === entry.file);
            if (!(await fs.readFile(entry.file)).equals(change.original))
                throw new Error("Input changed during patch staging");
            await install(entry.temporary, entry.file);
            entry.installed = true;
        }
    }
    catch (error) {
        const failed = [];
        for (const entry of [...staged].reverse()) {
            if (entry.installed) {
                try {
                    await fs.rename(entry.backup, entry.file);
                }
                catch {
                    failed.push(entry.backup);
                }
            }
        }
        if (failed.length)
            recoveryNeeded = true;
        if (failed.length)
            throw new Error(`Patch rollback incomplete; recover original bytes from: ${failed.join(", ")}`, { cause: error });
        throw new Error("Patch failed; original files restored", { cause: error });
    }
    finally {
        for (const entry of staged) {
            await fs.rm(entry.temporary, { force: true }).catch(() => { });
            if (!recoveryNeeded)
                await fs.rm(entry.backup, { force: true }).catch(() => { });
        }
    }
}
//# sourceMappingURL=transaction.js.map