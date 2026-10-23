import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRepository } from '../dist/scanner.js';
import { loadRegistry } from '../dist/registry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}
const casesPath = path.resolve(getArg('--cases', path.join(root, 'data/scanner-benchmark.jsonl')));
const format = getArg('--format', 'text');
const minPrecision = Number(getArg('--min-precision', '0.95'));
const minRecall = Number(getArg('--min-recall', '0.90'));
const cases = (await readFile(casesPath, 'utf8')).split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`Invalid JSONL at line ${index + 1}: ${error.message}`); }
});
const registry = await loadRegistry(path.join(root, 'data/registry.json'));
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'modeldeps-benchmark-'));
let tp = 0, fp = 0, fn = 0;
const details = [];
try {
  for (const item of cases) {
    if (!item.id || !item.filename || typeof item.content !== 'string' || !Array.isArray(item.expected)) {
      throw new Error(`Benchmark case at line ${details.length + 1} requires id, filename, content, and expected[].`);
    }
    const caseRoot = path.join(tempRoot, item.id);
    await mkdir(path.dirname(path.join(caseRoot, item.filename)), { recursive: true });
    await writeFile(path.join(caseRoot, item.filename), item.content, 'utf8');
    const findings = await scanRepository(caseRoot, registry);
    const actual = findings.map((finding) => finding.model_id).sort();
    const expected = [...item.expected].sort();
    const actualCounts = new Map();
    for (const id of actual) actualCounts.set(id, (actualCounts.get(id) ?? 0) + 1);
    const expectedCounts = new Map();
    for (const id of expected) expectedCounts.set(id, (expectedCounts.get(id) ?? 0) + 1);
    const all = new Set([...actualCounts.keys(), ...expectedCounts.keys()]);
    let caseTp = 0, caseFp = 0, caseFn = 0;
    for (const id of all) {
      const a = actualCounts.get(id) ?? 0;
      const e = expectedCounts.get(id) ?? 0;
      caseTp += Math.min(a, e);
      caseFp += Math.max(0, a - e);
      caseFn += Math.max(0, e - a);
    }
    tp += caseTp; fp += caseFp; fn += caseFn;
    details.push({ id: item.id, expected, actual, pass: caseFp === 0 && caseFn === 0, false_positives: caseFp, false_negatives: caseFn, rationale: item.rationale ?? '' });
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
const f1 = precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall);
const result = { schema_version: '0.2', cases: cases.length, true_positives: tp, false_positives: fp, false_negatives: fn, precision, recall, f1, thresholds: { min_precision: minPrecision, min_recall: minRecall }, pass: precision >= minPrecision && recall >= minRecall, details };
if (format === 'json') process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else {
  process.stdout.write(`ModelDeps scanner benchmark — ${cases.length} cases\n`);
  process.stdout.write(`TP ${tp} | FP ${fp} | FN ${fn}\n`);
  process.stdout.write(`Precision ${(precision * 100).toFixed(1)}% | Recall ${(recall * 100).toFixed(1)}% | F1 ${(f1 * 100).toFixed(1)}%\n`);
  process.stdout.write(`Thresholds: precision >= ${(minPrecision * 100).toFixed(1)}%, recall >= ${(minRecall * 100).toFixed(1)}%\n`);
  for (const item of details.filter((entry) => !entry.pass)) process.stdout.write(`FAIL ${item.id}: expected [${item.expected.join(', ')}], got [${item.actual.join(', ')}] (${item.rationale})\n`);
  process.stdout.write(`${result.pass ? 'BENCHMARK PASS' : 'BENCHMARK FAIL'}\n`);
}
if (!result.pass) process.exitCode = 1;
