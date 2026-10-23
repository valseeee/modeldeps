export class SourceError extends Error {}

/** Bound decompressed response bytes while streaming, before allocating the full body. */
export async function boundedText(response: Response, limit: number): Promise<string> {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("Source exceeds byte limit.");
  if (!response.body) throw new Error("Source response has no body.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Source exceeds byte limit.");
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(Buffer.concat(chunks));
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}
