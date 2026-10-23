import * as fs from "node:fs/promises";
/** Stage all writes, retain originals, and roll back installed files on an I/O failure.
 * This is process-level rollback, not crash-atomicity across multiple files.
 */
export declare function transactionalWrite(changes: Array<{
    file: string;
    original: Buffer;
    content: string;
}>, install?: typeof fs.rename): Promise<void>;
