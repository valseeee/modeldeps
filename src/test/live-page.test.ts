import test from "node:test";
import assert from "node:assert/strict";
import { parseOfficialLifecyclePage } from "../providers/live-page.js";

const anthropicHtml = `
<h2>Model status</h2><table><thead><tr><th>API model name</th><th>Current state</th><th>Deprecated</th><th>Tentative retirement date</th></tr></thead><tbody>
<tr><td><code>claude-opus-4-8</code></td><td>Active</td><td>N/A</td><td>Not sooner than May 28, 2027</td></tr>
<tr><td><code>claude-opus-4-7</code></td><td>Active</td><td>N/A</td><td>Not sooner than April 16, 2027</td></tr>
<tr><td><code>claude-opus-4-6</code></td><td>Active</td><td>N/A</td><td>Not sooner than February 5, 2027</td></tr>
<tr><td><code>claude-opus-4-1-20250805</code></td><td>Retired</td><td>June 5, 2026</td><td>August 5, 2026</td></tr>
<tr><td><code>claude-sonnet-4-20250514</code></td><td>Retired</td><td>April 14, 2026</td><td>June 15, 2026</td></tr>
</tbody></table>
<h2>Deprecation history</h2><table><thead><tr><th>Retirement date</th><th>Deprecated model</th><th>Recommended replacement</th></tr></thead><tbody>
<tr><td>August 5, 2026</td><td><code>claude-opus-4-1-20250805</code></td><td><code>claude-opus-4-8</code></td></tr>
</tbody></table>`;

const googleHtml = `
<h2>Gemini 3 models</h2><table><thead><tr><th>Model</th><th>Release date</th><th>Shutdown date</th><th>Recommended replacement</th></tr></thead><tbody>
<tr><td><code>gemini-3.8-flash</code></td><td>September 2, 2026</td><td>No shutdown date announced</td><td></td></tr>
<tr><td><code>gemini-3.1-flash-lite</code></td><td>May 7, 2026</td><td>May 7, 2027</td><td><code>gemini-3.5-flash-lite</code></td></tr>
<tr><td><code>gemini-3.7-flash</code></td><td>August 13, 2026</td><td>N/A</td><td><code>gemini-3.8-flash</code> (not available to select in Google AI Studio; endpoint automatically routes to gemini-3.8-flash)</td></tr>
<tr><td><code>gemini-3.1-pro-preview</code></td><td>February 19, 2026</td><td>No shutdown date announced</td><td></td></tr>
<tr><td><code>gemini-3.1-flash-tts-preview</code></td><td>February 26, 2026</td><td>November 17, 2026</td><td><code>gemini-3.8-flash-tts</code></td></tr>
</tbody></table>`;

test("Anthropic live parser keeps official statuses and replacement evidence", () => {
  const result = parseOfficialLifecyclePage("anthropic", anthropicHtml, "https://platform.claude.com/docs/en/about-claude/model-deprecations", "2026-10-23T00:00:00.000Z", "a".repeat(64));
  assert.equal(result.models.length, 5);
  const retired = result.models.find((m) => m.model_id === "claude-opus-4-1-20250805");
  assert.equal(retired?.status, "retired");
  assert.equal(retired?.shutdown_at, "2026-08-05");
  assert.equal(retired?.shutdown_date_kind, "tentative");
  assert.equal(retired?.recommended_replacements[0]?.model_id, "claude-opus-4-8");
  assert.equal(retired?.replacement_source?.evidence_mode, "live-page");
  assert.equal(retired?.source.sha256, "a".repeat(64));
});

test("Google parser marks shutdown dates earliest-possible and does not infer retirement", () => {
  const result = parseOfficialLifecyclePage("google", googleHtml, "https://ai.google.dev/gemini-api/docs/deprecations", "2026-10-23T00:00:00.000Z", "b".repeat(64));
  const dated = result.models.find((m) => m.model_id === "gemini-3.1-flash-lite");
  assert.equal(dated?.status, "deprecated");
  assert.equal(dated?.shutdown_at, "2027-05-07");
  assert.equal(dated?.shutdown_date_kind, "earliest-possible");
  assert.equal(dated?.recommended_replacements[0]?.model_id, "gemini-3.5-flash-lite");
  const alias = result.models.find((m) => m.model_id === "gemini-3.7-flash");
  assert.equal(alias?.recommended_replacements[0]?.model_id, "gemini-3.8-flash");
  const preview = result.models.find((m) => m.model_id === "gemini-3.1-pro-preview");
  assert.equal(preview?.status, "preview");
  assert.equal(preview?.shutdown_at, undefined);
});

test("live parser fails closed on non-official source hosts or unexpected page structure", () => {
  assert.throws(() => parseOfficialLifecyclePage("google", googleHtml, "https://example.com/page"), /official google host/);
  assert.throws(() => parseOfficialLifecyclePage("google", "<html><body>changed layout</body></html>", "https://ai.google.dev/gemini-api/docs/deprecations"), /found only 0 model rows/);
});


test("live parser rejects duplicate rows and invalid calendar dates", () => {
  const url = "https://ai.google.dev/gemini-api/docs/deprecations";
  assert.throws(() => parseOfficialLifecyclePage("google", googleHtml.replace("gemini-3.1-flash-lite</code>", "gemini-3.8-flash</code>"), url), /Duplicate/);
  assert.throws(() => parseOfficialLifecyclePage("google", googleHtml.replace("May 7, 2027", "2027-02-30"), url), /Unrecognized shutdown/);
});


test("missing replacement is preserved as unknown instead of guessed", () => {
  const html = googleHtml.replace('<code>gemini-3.5-flash-lite</code>', 'N/A');
  const result = parseOfficialLifecyclePage("google", html, "https://ai.google.dev/gemini-api/docs/deprecations");
  assert.deepEqual(result.models.find(m => m.model_id === "gemini-3.1-flash-lite")?.recommended_replacements, []);
});

test("Google preview dividers require the explicit full-width section markup", () => {
  const divider = '<tr><td colspan="4">Preview models</td></tr>';
  const extra = '<tr><td>lyria-realtime-exp</td><td>May 20, 2025</td><td>No shutdown date announced</td><td></td></tr>';
  const html = googleHtml.replace('</tbody>', divider + extra + '</tbody>');
  const url = "https://ai.google.dev/gemini-api/docs/deprecations";
  const result = parseOfficialLifecyclePage("google", html, url);
  assert.equal(result.models.length, 6);
  assert.equal(result.models.find(m => m.model_id === "lyria-realtime-exp")?.status, "preview");
  assert.equal(result.models.find(m => m.model_id === "gemini-3.8-flash")?.status, "active");
  assert.throws(() => parseOfficialLifecyclePage("google", html.replace('colspan="4"', 'colspan="3"'), url), /canonical model ID/);
  assert.throws(() => parseOfficialLifecyclePage("google", html.replace('Preview models', 'Unexpected section'), url), /canonical model ID/);
});

test("Google consolidates identical cross-table references but rejects conflicting or same-table duplicates", () => {
  const url = "https://ai.google.dev/gemini-api/docs/deprecations";
  const result = parseOfficialLifecyclePage("google", googleHtml + googleHtml, url);
  assert.equal(result.models.length, 5);
  assert.equal(result.warnings.length, 5);
  assert.throws(() => parseOfficialLifecyclePage("google", googleHtml + googleHtml.replace('May 7, 2027', 'May 8, 2027'), url), /conflicting lifecycle facts/);
  const duplicate = '<tr><td>gemini-3.8-flash</td><td>September 2, 2026</td><td>No shutdown date announced</td><td></td></tr>';
  assert.throws(() => parseOfficialLifecyclePage("google", googleHtml.replace('</tbody>', duplicate + '</tbody>'), url), /Duplicate model row/);
});

test("explicit official alternative replacements are preserved without mining explanatory parentheses", () => {
  const html = googleHtml.replace('<code>gemini-3.8-flash-tts</code>', '<code>gemini-3.8-flash-tts</code> or <code>gemini-3.8-flash-lite-tts</code> (routes to a different-model in some accounts)');
  const result = parseOfficialLifecyclePage("google", html, "https://ai.google.dev/gemini-api/docs/deprecations");
  assert.deepEqual(result.models.find(m => m.model_id === "gemini-3.1-flash-tts-preview")?.recommended_replacements.map(r => r.model_id), ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"]);
});
