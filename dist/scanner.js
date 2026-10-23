import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { matchesAnyPattern, normalizeRelative } from "./util.js";
const SCANNED_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".json", ".yaml", ".yml", ".toml", ".env", ".ini", ".properties", ".cfg"
]);
const DEFAULT_IGNORE = ["**/node_modules/**", "**/.git/**", "**/.modeldeps/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.venv/**", "**/venv/**"];
function inferProvider(modelId) {
    const id = modelId.toLowerCase();
    if (/^(gpt-|o\d+(?:-|$)|chatgpt-|text-embedding-|dall-e-|whisper-|gpt-image-|tts-\d|sora-|codex-|computer-use-|omni-moderation|ft-gpt-|ft-o\d|ft-babbage-|ft-davinci-)/.test(id))
        return "openai";
    if (/^claude-/.test(id))
        return "anthropic";
    if (/^(?:models\/)?gemini-/.test(id))
        return "google";
    return "unknown";
}
function defaultSurface(provider) {
    if (provider === "openai")
        return "openai-api";
    if (provider === "anthropic")
        return "anthropic-api";
    if (provider === "google")
        return "gemini-api";
    return "unknown";
}
function isHashCommentFile(extension, fileName) {
    return [".py", ".yaml", ".yml", ".toml", ".ini", ".properties", ".cfg", ".env"].includes(extension)
        || fileName === ".env" || /^\.env\./.test(fileName);
}
/** Remove comments without mistaking comment markers inside quoted strings for comments. */
function stripComments(line, extension, fileName, state) {
    let quote = null;
    let escaped = false;
    let output = "";
    const hashComments = isHashCommentFile(extension, fileName);
    const slashComments = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(extension);
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];
        if (state.inBlockComment) {
            if (char === "*" && next === "/") {
                state.inBlockComment = false;
                i += 1;
                output += "  ";
            }
            else
                output += " ";
            continue;
        }
        if (quote !== null) {
            output += char;
            if (escaped)
                escaped = false;
            else if (char === "\\")
                escaped = true;
            else if (char === quote)
                quote = null;
            continue;
        }
        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            output += char;
            continue;
        }
        if (slashComments && char === "/" && next === "*") {
            state.inBlockComment = true;
            output += "  ";
            i += 1;
            continue;
        }
        if (slashComments && char === "/" && next === "/")
            break;
        if (hashComments && char === "#")
            break;
        output += char;
    }
    return output;
}
/** Return the string token that contains an offset, if any. End is exclusive. */
function stringTokenContainingOffset(line, offset) {
    let quote = null;
    let start = -1;
    let escaped = false;
    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        if (quote !== null) {
            if (i === offset) {
                // The token's opening quote is part of the token too.
                if (i === start)
                    return { start, end: -1, quote };
            }
            if (escaped)
                escaped = false;
            else if (char === "\\")
                escaped = true;
            else if (char === quote) {
                const token = { start, end: i + 1, quote };
                if (offset >= start && offset < token.end)
                    return token;
                quote = null;
            }
            continue;
        }
        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            start = i;
            if (i === offset)
                return { start, end: -1, quote };
        }
    }
    if (quote !== null && offset >= start && offset < line.length)
        return { start, end: line.length, quote };
    return undefined;
}
function shouldSkipQuotedValueMatch(line, match) {
    const matchStart = match.index ?? 0;
    const key = match[1];
    if (!key)
        return false;
    const relativeKeyStart = match[0].indexOf(key);
    if (relativeKeyStart < 0)
        return false;
    const keyStart = matchStart + relativeKeyStart;
    const token = stringTokenContainingOffset(line, keyStart);
    if (!token)
        return false;
    // A quoted JSON/JS key is valid only when the key itself is a complete string
    // token immediately followed by ':' or '='. A key-shaped substring inside a
    // larger documentation string or template literal is not a dependency.
    const keyTokenEnd = keyStart + key.length + 1;
    const afterKeyToken = line.slice(keyTokenEnd).trimStart();
    const isStandaloneQuotedKey = token.start === matchStart
        && token.end === keyTokenEnd
        && (afterKeyToken.startsWith(":") || afterKeyToken.startsWith("="));
    return !isStandaloneQuotedKey;
}
function isModelKey(key) {
    return /^(?:[A-Za-z_$][\w$.-]*(?:model|llm|engine)[\w$.-]*|model(?:[._-]?(?:id|name))?|llm|engine)$/i.test(key);
}
function lineCandidates(line, extension, fileName) {
    const found = new Map();
    // Source code and structured files: only treat values attached to a model-like key
    // as model references. This deliberately avoids reporting model IDs in arbitrary
    // strings, sample prose, and log messages as production dependencies.
    const quotedValue = /(?<![\w$.-])(?:["'`])?([A-Za-z_$][\w$.-]{0,127})(?:["'`])?\s*[:=]\s*(["'`])([^"'`\r\n]{1,160})\2/gi;
    for (const match of line.matchAll(quotedValue)) {
        if (!isModelKey(match[1]) || shouldSkipQuotedValueMatch(line, match))
            continue;
        const value = match[3];
        if (!value?.trim() || value.includes("$") || value.includes("{{") || value.includes("}}"))
            continue;
        const offset = (match.index ?? 0) + match[0].lastIndexOf(match[3]);
        found.set(`${value}:${offset}`, { model_id: value, offset, confidence: 0.96 });
    }
    // Unquoted environment variables, e.g. OPENAI_MODEL=gpt-5.4-cyber.
    const envValue = /(?<![\w.-])([A-Za-z_][\w.-]{0,127})\s*=\s*([^\s#"'`;,}]{1,160})/gi;
    for (const match of line.matchAll(envValue)) {
        if (!/^[A-Za-z_][\w.-]*(?:MODEL_ID|MODEL_NAME|MODELID|MODELNAME|MODEL)$/i.test(match[1]) || stringTokenContainingOffset(line, match.index ?? 0))
            continue;
        const value = match[2]?.trim();
        if (!value || value.includes("$") || value.includes("{{") || value.includes("}}"))
            continue;
        const offset = (match.index ?? 0) + match[0].lastIndexOf(match[2]);
        found.set(`${value}:${offset}`, { model_id: value, offset, confidence: 0.92 });
    }
    // Unquoted YAML/TOML model value: model: gemini-... / model = custom-name.
    const configExtensions = new Set([".yaml", ".yml", ".toml", ".ini", ".properties", ".cfg"]);
    if (configExtensions.has(extension) || fileName === ".env" || /^\.env\./.test(fileName)) {
        const unquotedConfig = /^\s*["']?([A-Za-z_$][\w$.-]{0,127})["']?\s*[:=]\s*([^\s#"'`,}\]]{1,160})/i;
        const match = line.match(unquotedConfig);
        const value = match?.[2]?.trim();
        if (match && isModelKey(match[1]) && !stringTokenContainingOffset(line, match.index ?? 0) && value && !["true", "false", "null", "none", "undefined"].includes(value.toLowerCase())
            && !value.includes("$") && !value.includes("{{") && !value.includes("}}")) {
            const offset = line.indexOf(value, match.index ?? 0);
            found.set(`${value}:${offset}`, { model_id: value, offset, confidence: 0.88 });
        }
    }
    return [...found.values()].sort((a, b) => a.offset - b.offset);
}
async function walkFiles(root, ignore, deadline, maxFiles) {
    const allIgnore = [...DEFAULT_IGNORE, ...ignore];
    const files = [];
    let visited = 0;
    const visit = async (directory) => {
        let entries;
        try {
            entries = await readdir(directory, { withFileTypes: true });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Cannot read directory ${directory}: ${message}`);
        }
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            if (++visited > maxFiles || Date.now() > deadline)
                throw new Error("Scan traversal budget exceeded");
            const fullPath = path.join(directory, entry.name);
            const relative = normalizeRelative(root, fullPath);
            if (matchesAnyPattern(relative, allIgnore) || matchesAnyPattern(`/${relative}`, allIgnore))
                continue;
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory())
                await visit(fullPath);
            else if (entry.isFile() && (SCANNED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) || entry.name === ".env" || /^\.env\.[\w.-]+$/.test(entry.name)))
                files.push(fullPath);
        }
    };
    await visit(root);
    return files;
}
export async function scanRepository(rootInput, registry, options = {}) {
    const root = path.resolve(rootInput);
    const ignore = options.ignore ?? [];
    const enabledProviders = options.providers ? new Set(options.providers) : undefined;
    const deadline = Date.now() + (options.timeoutMs ?? 120000);
    const files = await walkFiles(root, ignore, deadline, options.maxFiles ?? 50000);
    let scannedBytes = 0;
    const findings = [];
    // Bound in-flight I/O to eight files while retaining deterministic scan order.
    for (let offset = 0; offset < files.length; offset += 8) {
        const inputs = await Promise.allSettled(files.slice(offset, offset + 8).map(async (filePath) => {
            const size = (await stat(filePath)).size;
            scannedBytes += size;
            if (size > 10000000 || scannedBytes > (options.maxBytes ?? 250000000) || Date.now() > deadline)
                throw new Error("Scan byte/time budget exceeded");
            return { filePath, content: await readFile(filePath, "utf8") };
        }));
        for (const input of inputs) {
            if (input.status === "rejected")
                throw input.reason;
            const { filePath, content } = input.value;
            const extension = path.extname(filePath).toLowerCase();
            const fileName = path.basename(filePath);
            const lines = content.split(/\r?\n/);
            const commentState = { inBlockComment: false };
            for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
                if (lineIndex % 1000 === 0 && Date.now() > deadline)
                    throw new Error("Scan time budget exceeded");
                const originalLine = lines[lineIndex];
                if (originalLine.length > 1_000_000)
                    throw new Error(`Scan line size budget exceeded: ${normalizeRelative(root, filePath)}:${lineIndex + 1}`);
                const line = stripComments(originalLine, extension, fileName, commentState);
                if (!line.trim())
                    continue;
                for (const candidate of lineCandidates(line, extension, fileName)) {
                    const matchingRecords = registry.models.filter((record) => record.model_id === candidate.model_id);
                    const inferred = inferProvider(candidate.model_id);
                    let provider;
                    let surface;
                    let confidence = candidate.confidence;
                    let resolution;
                    if (matchingRecords.length === 1) {
                        provider = matchingRecords[0].provider;
                        surface = matchingRecords[0].surface;
                        confidence = Math.max(confidence, 0.99);
                        resolution = "registry-exact";
                    }
                    else if (matchingRecords.length > 1) {
                        const providers = new Set(matchingRecords.map((record) => record.provider));
                        const surfaces = new Set(matchingRecords.map((record) => `${record.provider}/${record.surface}`));
                        if (providers.size === 1 && surfaces.size > 1) {
                            provider = matchingRecords[0].provider;
                            surface = "unknown";
                            confidence = Math.min(confidence, 0.65);
                            resolution = "ambiguous-surface";
                        }
                        else {
                            provider = inferred;
                            surface = "unknown";
                            confidence = Math.min(confidence, 0.55);
                            resolution = "unknown";
                        }
                    }
                    else {
                        provider = inferred;
                        surface = defaultSurface(provider);
                        resolution = provider === "unknown" ? "unknown" : "provider-prefix";
                        if (provider === "unknown")
                            confidence = Math.min(confidence, 0.7);
                    }
                    if (provider !== "unknown" && enabledProviders && !enabledProviders.has(provider))
                        continue;
                    findings.push({
                        provider,
                        surface,
                        model_id: candidate.model_id,
                        file: normalizeRelative(root, filePath),
                        line: lineIndex + 1,
                        column: candidate.offset + 1,
                        confidence,
                        evidence: originalLine.trim().slice(0, 240),
                        resolution
                    });
                }
            }
        }
    }
    const unique = new Map();
    for (const finding of findings) {
        const key = `${finding.file}\0${finding.line}\0${finding.column}\0${finding.provider}\0${finding.surface}\0${finding.model_id}`;
        unique.set(key, finding);
    }
    return [...unique.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
}
//# sourceMappingURL=scanner.js.map