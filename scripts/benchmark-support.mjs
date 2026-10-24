import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function treeUsage(root, maxBytes = Infinity, maxFiles = Infinity) {
  let bytes = 0, files = 0;
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return; throw e; }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(file);
      else if (entry.isFile()) {
        let info;
        try { info = await fs.lstat(file); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
        if (!info.isFile()) continue;
        bytes += info.size; files++;
      }
      if (bytes > maxBytes || files > maxFiles) throw new Error('Repository resource budget exceeded');
    }
  }
  await walk(root);
  return { bytes, files };
}

/** Watchdog limits are sampled, not an operating-system disk quota. Never execute target code. */
export async function boundedGit(args, cwd, budgetRoot, { timeoutMs = 120000, maxBytes = 250000000, maxFiles = 50000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.longpaths=true', '-c', 'core.fsmonitor=false', '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', '-c', 'protocol.file.allow=never', ...args], {
      cwd, windowsHide: true, detached: process.platform !== 'win32', env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' }, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '', failure, checking = false, activeCheck = Promise.resolve();
    function stop(error) {
      if (failure) return;
      failure = error;
      if (process.platform === 'win32' && child.pid) {
        const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('error', () => child.kill('SIGKILL'));
        killer.once('exit', () => child.kill('SIGKILL'));
      } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }
    }
    const timer = setTimeout(() => stop(new Error('Git timeout exceeded')), timeoutMs);
    const watch = setInterval(() => {
      if (checking) return;
      checking = true;
      activeCheck = (async () => {
      try { await treeUsage(budgetRoot, maxBytes, maxFiles); } catch (e) { stop(e); }
      checking = false;
      })();
    }, 200);
    for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
      output += chunk;
      if (Buffer.byteLength(output) > 1000000) stop(new Error('Git output budget exceeded'));
    });
    child.on('error', error => { clearTimeout(timer); clearInterval(watch); reject(error); });
    child.on('close', async code => {
      clearTimeout(timer); clearInterval(watch);
      try {
        await activeCheck;
        if (failure) throw failure;
        if (code !== 0) throw new Error(`git ${args[0]} failed (${code}): ${output.slice(-2000)}`);
        await treeUsage(budgetRoot, maxBytes, maxFiles);
        resolve(output.trim());
      } catch (error) { reject(error); }
    });
  });
}

function key(f) { return JSON.stringify([f.file.replaceAll('\\', '/'), f.line, f.column, f.provider ?? 'unknown', f.surface ?? 'unknown', f.model_id]); }
export function scoreFindings(actual, expected) {
  const remaining = new Map(expected.map(f => [key(f), f]));
  if (remaining.size !== expected.length) throw new Error("Duplicate gold labels");
  const matches = [], false_positives = [];
  for (const f of actual) { if (remaining.delete(key(f))) matches.push(f); else false_positives.push(f); }
  const false_negatives = [...remaining.values()];
  const tp = matches.length, fp = false_positives.length, fn = false_negatives.length;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = 2 * tp + fp + fn ? 2 * tp / (2 * tp + fp + fn) : null;
  return { tp, fp, fn, precision, recall, f1, false_positives, false_negatives };
}
export function groupedScores(actual, expected, dimension) {
  const group = f => dimension === 'file_type' ? path.extname(f.file) || 'none' : dimension === 'language' ? ({ '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.py': 'Python', '.json': 'JSON', '.yml': 'YAML', '.yaml': 'YAML' }[path.extname(f.file)] ?? 'other') : f[dimension] ?? 'unknown';
  return Object.fromEntries([...new Set([...actual, ...expected].map(group))].sort().map(value => [value, scoreFindings(actual.filter(f => group(f) === value), expected.filter(f => group(f) === value))]));
}
