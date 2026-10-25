#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { scanRepository } from '../dist/scanner.js';
import { loadRegistry } from '../dist/registry.js';
import { boundedGit, treeUsage, scoreFindings, groupedScores } from './benchmark-support.mjs';
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const flag = name => args.includes(name);
const number = (name, fallback) => { const n = Number(arg(name, fallback)); if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`); return n; };
const digest = text => createHash('sha256').update(text).digest('hex');
const manifestPath = path.resolve(arg('--manifest', path.join(projectRoot, 'data/real-repo-benchmark/repos.json')));
const registryPath = path.resolve(arg('--registry', path.join(projectRoot, 'data/registry.json')));
const outputPath = arg('--output') && path.resolve(arg('--output'));
const templatePath = arg('--write-template') && path.resolve(arg('--write-template'));
const cloneRoot = path.resolve(arg('--clone-root', path.join(projectRoot, '.modeldeps/benchmark-repos')));
const limits = { timeoutMs: number('--timeout-seconds', 120) * 1000, maxBytes: number('--max-mb', 250) * 1000000, maxFiles: number('--max-files', 50000) };
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!Array.isArray(manifest.repositories)) throw new Error('Manifest must contain repositories[]');
const selected = manifest.repositories.slice(0, number('--max-repos', 1000));
const registry = await loadRegistry(registryPath);
const registry_sha256 = digest(await readFile(registryPath));
const implementation_sha256 = digest(Buffer.concat(await Promise.all(['scripts/benchmark-real-repos.mjs', 'scripts/benchmark-support.mjs', 'dist/scanner.js', 'dist/registry.js', 'dist/util.js', 'dist/types.js'].map(f => readFile(path.join(projectRoot, f))))));
const configuration = { limits, scope: 'scanner-supported files; scanner default ignores; no target code execution', registry_sha256, implementation_sha256 };
let prior;
if (outputPath) {
  try { prior = JSON.parse(await readFile(outputPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (prior && !flag('--resume')) throw new Error('Report already exists; use a new versioned output or --resume');
}
const reports = [], candidates = [], pinned = [];
const git = (repo, ...a) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.longpaths=true', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', ...a], { cwd: repo, encoding: 'utf8', timeout: limits.timeoutMs, maxBuffer: 1000000 }).trim();
const allActual = [], allExpected = [];
async function atomic(file, value) { await mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.tmp`; await writeFile(tmp, JSON.stringify(value, null, 2) + '\n'); await rename(tmp, file); }
async function checkpoint() {
  const result = { schema_version: '1.2', generated_at: new Date().toISOString(), scanner_version: '0.4.1', configuration, command: args, node_version: process.version, mode: reports.some(r => r.labeled) ? 'scored' : 'inventory-only', repositories: reports, aggregate: allExpected.length || reports.some(r => r.labeled) ? scoreFindings(allActual, allExpected) : null, groups: Object.fromEntries(['language', 'file_type', 'provider', 'framework'].map(d => [d, groupedScores(allActual, allExpected, d)])), summary: { selected: selected.length, scanned: reports.filter(r => r.status === 'scanned').length, failed: reports.filter(r => r.status === 'failed').length, human_labeled: reports.filter(r => r.labeled).length } };
  if (outputPath) await atomic(outputPath, result); else if (reports.length === selected.length) console.log(JSON.stringify(result, null, 2));
}
for (const entry of selected) {
  try {
    if (!entry.name || (!entry.path && !entry.url)) throw new Error('Repo requires name and path or URL');
    if (entry.commit && !/^[a-f0-9]{40}$/.test(entry.commit)) throw new Error('Commit must be a full SHA');
    const sparsePaths = entry.sparse_paths ?? [];
    if (!Array.isArray(sparsePaths) || sparsePaths.length > 20 || sparsePaths.some(p => typeof p !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(p) || p.startsWith('/') || p.split('/').some(part => !part || ['.', '..', '.git'].includes(part.toLowerCase())))) throw new Error('sparse_paths must contain safe repository-relative directory paths');
    if (new Set(sparsePaths).size !== sparsePaths.length) throw new Error('Duplicate sparse checkout paths');
    const repoPath = entry.path ? path.resolve(path.dirname(manifestPath), entry.path) : path.join(cloneRoot, digest(entry.url).slice(0, 16));
    if (!entry.path && flag('--clone')) {
      if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(entry.url)) throw new Error('Only public GitHub HTTPS URLs allowed');
      await mkdir(cloneRoot, { recursive: true });
      try { git(repoPath, 'rev-parse', 'HEAD'); } catch {
        // Each attempt has a new directory, so an interrupted checkout is never treated as complete.
        const staging = `${repoPath}-${Date.now()}`;
        await boundedGit(['clone', '--depth', '1', '--no-checkout', ...(sparsePaths.length ? ['--filter=blob:none'] : []), entry.url, staging], cloneRoot, staging, limits);
        if (entry.commit) await boundedGit(['fetch', '--depth', '1', 'origin', entry.commit], staging, staging, limits);
        if (sparsePaths.length) {
          for (const p of sparsePaths) if (git(staging, 'cat-file', '-t', `${entry.commit ?? 'HEAD'}:${p}`) !== 'tree') throw new Error('Sparse checkout path is not a repository directory');
          await boundedGit(['sparse-checkout', 'init', '--cone'], staging, staging, limits);
          await boundedGit(['sparse-checkout', 'set', '--cone', '--', ...sparsePaths], staging, staging, limits);
        }
        await boundedGit(['checkout', '--detach', entry.commit ?? 'HEAD'], staging, staging, limits);
        // Preserve incomplete directories for inspection rather than recursively deleting user paths.
        try { await access(repoPath); throw new Error(`Incomplete checkout at ${repoPath}; use a fresh clone root`); } catch(e) { if (e.code !== 'ENOENT') throw e; }
        for (let attempt = 0; ; attempt++) {
          try { await rename(staging, repoPath); break; }
          catch (e) { if (e.code !== 'EPERM' || attempt >= 5) throw e; await new Promise(resolve => setTimeout(resolve, 100)); }
        }
      }
    }
    try { await access(path.join(repoPath, '.git')); } catch { reports.push({ name: entry.name, status: 'skipped', reason: 'No checkout; use --clone' }); await checkpoint(); continue; }
    const commit = git(repoPath, 'rev-parse', 'HEAD');
    if (entry.commit && entry.commit !== commit) throw new Error('Checkout differs from pinned commit');
    let sparseEnabled = false;
    try { sparseEnabled = git(repoPath, 'config', '--bool', 'core.sparseCheckout') === 'true'; } catch {}
    if (sparseEnabled && git(repoPath, 'config', '--bool', 'core.sparseCheckoutCone') !== 'true') throw new Error('Sparse benchmark checkouts must use Git cone mode');
    const actualSparsePaths = sparseEnabled ? git(repoPath, 'sparse-checkout', 'list').split(/\r?\n/).filter(Boolean) : [];
    if (sparseEnabled !== (sparsePaths.length > 0) || JSON.stringify([...actualSparsePaths].sort()) !== JSON.stringify([...sparsePaths].sort())) throw new Error('Actual sparse checkout differs from the declared sparse_paths');
    const usage = await treeUsage(repoPath, limits.maxBytes, limits.maxFiles);
    if (git(repoPath, 'status', '--porcelain', '--untracked-files=all', '--ignored=matching')) throw new Error('Dirty benchmark checkout (tracked, untracked or ignored files); refusing inaccurate commit attribution');
    const scan_config = { ignore: entry.ignore ?? [], sparse_paths: sparsePaths };
    if (!Array.isArray(scan_config.ignore) || !scan_config.ignore.every(pattern => typeof pattern === 'string')) throw new Error('Repository ignore must be a string list');
    const previous = prior?.repositories?.find(r => r.name === entry.name && r.commit === commit && r.status === 'scanned');
    const reusable = previous && JSON.stringify(prior.configuration) === JSON.stringify(configuration) && JSON.stringify(previous.scan_config) === JSON.stringify(scan_config);
    const findings = reusable ? previous.findings : (await scanRepository(repoPath, registry, { maxBytes: limits.maxBytes, maxFiles: limits.maxFiles, timeoutMs: limits.timeoutMs, ignore: scan_config.ignore })).map(f => ({ ...f, context: f.evidence, rule: f.resolution ?? 'scanner', language: path.extname(f.file) }));
    const framework = entry.framework ?? 'unknown';
    const actual = findings.map(f => ({ ...f, framework }));
    const labeled = entry.reviewed === true && Array.isArray(entry.expected_findings);
    if (labeled && entry.commit !== commit) throw new Error('Gold labels require matching full commit SHA');
    const expected = labeled ? entry.expected_findings.map(f => ({ ...f, framework })) : [];
    if (labeled && expected.some(f => !Number.isInteger(f.line) || f.line < 1 || !Number.isInteger(f.column) || f.column < 1)) throw new Error('Gold labels require positive line and column');
    let license = null;
    for (const file of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING']) { try { const text = await readFile(path.join(repoPath, file), 'utf8'); license = { file, sha256: digest(text), excerpt: text.slice(0, 160), review_required: true }; break; } catch {} }
    const report = { name: entry.name, url: entry.url ?? null, commit, scanned_at: new Date().toISOString(), status: 'scanned', scan_config, scope_note: entry.scope_note ?? null, default_branch: (() => { try { return git(repoPath, 'symbolic-ref', 'refs/remotes/origin/HEAD'); } catch { return null; } })(), license, usage, findings: actual, labeled, resumed: Boolean(reusable), ...(labeled ? { score: scoreFindings(actual, expected) } : {}) };
    reports.push(report);
    if (labeled) { allActual.push(...actual.map(f => ({ ...f, file: `${entry.name}/${f.file}` }))); allExpected.push(...expected.map(f => ({ ...f, file: `${entry.name}/${f.file}` }))); }
    candidates.push({ name: entry.name, url: entry.url, path: entry.path, commit, reviewed: false, framework, ignore: scan_config.ignore, sparse_paths: sparsePaths, scope_note: entry.scope_note, expected_findings: actual.map(f => ({ ...f, review: 'unreviewed' })) });
    pinned.push({ name: entry.name, url: entry.url, path: entry.path, commit, framework, ignore: scan_config.ignore, sparse_paths: sparsePaths, scope_note: entry.scope_note });
    console.log(`${entry.name}: ${actual.length} candidates @ ${commit}`);
  } catch (error) { reports.push({ name: entry.name, status: 'failed', reason: error.message }); }
  await checkpoint();
}
if (templatePath) await atomic(templatePath, { schema_version: '1.2', note: 'Unreviewed candidates; human review and missed-reference annotation required', repositories: candidates });
if (outputPath) await atomic(`${outputPath}.pins.json`, { repositories: pinned });
if (reports.some(r => r.status === 'failed')) process.exitCode = 3;
else if (flag('--require-labels') && (reports.length === 0 || reports.some(r => !r.labeled))) process.exitCode = 1;
