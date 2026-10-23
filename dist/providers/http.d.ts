export declare class SourceError extends Error {
}
/** Bound decompressed response bytes while streaming, before allocating the full body. */
export declare function boundedText(response: Response, limit: number): Promise<string>;
