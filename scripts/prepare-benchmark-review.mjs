#!/usr/bin/env node
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error('Usage: node scripts/prepare-benchmark-review.mjs --output NEW_DIRECTORY REPORT.json [...]');
const output = path.resolve(args[outputIndex + 1]);
const inputs = args.filter((_, index) => index !== outputIndex && index !== outputIndex + 1);
if (!inputs.length || inputs.length > 20 || inputs.some(p => p.startsWith('-'))) throw new Error('Supply 1 to 20 benchmark reports');
const repositories = new Map();
for (const input of inputs) {
  if ((await stat(input)).size > 50000000) throw new Error('Benchmark report exceeds the 50 MB review input limit');
  const report = JSON.parse(await readFile(input, 'utf8'));
  if (!Array.isArray(report.repositories)) throw new Error('Report must contain repositories[]');
  for (const repo of report.repositories) {
    if (repo.status !== 'scanned') continue;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo.name) || !/^[a-f0-9]{40}$/.test(repo.commit) || !Array.isArray(repo.findings)) throw new Error('Scanned repository is missing its identity, fixed commit or findings');
    repositories.set(repo.name, { ...repo, source_report: input, implementation_sha256: report.configuration?.implementation_sha256, registry_sha256: report.configuration?.registry_sha256 });
  }
}
if (!repositories.size) throw new Error('No successful scanned repositories in the supplied reports');

function csv(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
const columns = ['repository', 'commit', 'file', 'line', 'column', 'provider', 'surface', 'model_id', 'rule', 'confidence', 'context', 'source_url', 'decision', 'reviewer'];
const lines = [columns.map(csv).join(',')];
const licenses = [['repository', 'commit', 'license_file', 'recorded_sha256', 'source_url', 'suitability_decision', 'reviewer'].map(csv).join(',')];
const template = [];
let candidates = 0;
for (const repo of repositories.values()) {
  const licenseFile = repo.license?.file ?? '';
  const licenseUrl = licenseFile ? `https://github.com/${repo.name}/blob/${repo.commit}/${encodeURIComponent(licenseFile)}` : '';
  licenses.push([repo.name, repo.commit, licenseFile, repo.license?.sha256 ?? '', licenseUrl, '', ''].map(csv).join(','));
  const expected = [];
  for (const finding of repo.findings) {
    const file = typeof finding.file === 'string' ? finding.file.replaceAll('\\', '/') : '';
    if (!file || file.startsWith('/') || file.split('/').includes('..') || !Number.isSafeInteger(finding.line) || finding.line < 1 || !Number.isSafeInteger(finding.column) || finding.column < 1 || typeof finding.model_id !== 'string') throw new Error('Candidate is missing a safe location or exact model identity');
    const identity = { file, line: finding.line, column: finding.column, provider: finding.provider ?? 'unknown', surface: finding.surface ?? 'unknown', model_id: finding.model_id };
    expected.push(identity);
    const url = `https://github.com/${repo.name}/blob/${repo.commit}/${file.split('/').map(encodeURIComponent).join('/')}#L${finding.line}`;
    const context = String(finding.context ?? finding.evidence ?? '').slice(0, 240);
    lines.push([repo.name, repo.commit, file, finding.line, finding.column, identity.provider, identity.surface, identity.model_id, finding.rule ?? finding.resolution ?? 'scanner', finding.confidence ?? '', context, url, '', ''].map(csv).join(','));
    candidates++;
  }
  template.push({ name: repo.name, url: `https://github.com/${repo.name}.git`, commit: repo.commit, framework: repo.framework ?? repo.findings[0]?.framework ?? 'unknown', ignore: repo.scan_config?.ignore ?? [], sparse_paths: repo.scan_config?.sparse_paths ?? [], scope_note: repo.scope_note ?? null, reviewed: false, review_note: 'Pending human review of the complete declared scope and independent search for missed references.', expected_findings: expected, source_report: repo.source_report, implementation_sha256: repo.implementation_sha256, registry_sha256: repo.registry_sha256 });
}

await mkdir(path.dirname(output), { recursive: true });
await mkdir(output); // A new directory is required; never overwrite a review in progress.
await writeFile(path.join(output, 'candidates.csv'), '\ufeff' + lines.join('\r\n') + '\r\n');
await writeFile(path.join(output, 'licenses.csv'), '\ufeff' + licenses.join('\r\n') + '\r\n');
await writeFile(path.join(output, 'review-template.json'), JSON.stringify({ schema_version: '1.2', note: 'Unreviewed candidates, not human gold. Reports supplied later replace earlier views of the same repository only in this new review pack; original reports remain unchanged.', repositories: template }, null, 2) + '\n');
const summary = { repositories: template.length, candidates, human_reviewed: 0, gold_ready: false, metrics: null, source_reports: inputs, review_progress: template.map(r => ({ name: r.name, commit: r.commit, candidates: r.expected_findings.length, reviewed: false, independent_missed_reference_search_completed: false })) };
await writeFile(path.join(output, 'review-progress.json'), JSON.stringify(summary, null, 2) + '\n');
await writeFile(path.join(output, 'README.zh-CN.md'), `# 真实仓库人工审核包

共 ${template.length} 个固定 commit、${candidates} 个未审候选。人工审核数为 0，真实准确率仍为 N/A。

1. 打开 candidates.csv，使用 source_url 查看固定 commit 的原文。decision 与 reviewer 默认留空；不要把候选数量当作正确数量。CSV 对潜在公式前缀增加显示用单引号，JSON 保留原始模型身份。
2. 对 review-template.json 的每个仓库核对 commit、ignore、sparse_paths 和 scope_note。稀疏 checkout 包括根目录/祖先文件，遗漏目录不在审核范围内。
3. 按项目标注规则审查整个声明范围：执行请求、实际配置和真实默认模型为正例；注释、单元测试/模拟、无关字符串与动态占位符为负例。可运行应用示例的归类应一致并说明理由。
4. 独立检查代码和模型调用点，添加漏报。只审候选无法验证 recall；把未完成的独立漏报搜索保留为 false。
5. 在 JSON 的 expected_findings 中删除误报并添加漏报，保留准确的 file/line/column/provider/surface/model_id。CSV 是辅助工作表，不会自动覆盖 JSON。
6. 只有人工确认整个声明范围并完成漏报搜索后，才把该仓库 reviewed 改为 true，并写 reviewer/范围/日期说明；本工具不会替你作此声明。
7. 保存为新的 reviewed-gold.json，使用 benchmark-real-repos.mjs --manifest reviewed-gold.json --clone --require-labels --output 新报告.json 评分。使用能复现固定 commit 和相同范围的 checkout，保留历史报告。

licenses.csv 提供固定 commit 的许可证链接和此前记录的 hash，审核结论与审核人保持留空。许可证仍需逐项审查；本包只提供定位链接、短上下文和待审模板。定义与评分协议见 data/real-repo-benchmark/README.md。

真实业务 eval 尚需提供业务项目路径、实际测试命令、代表性输入和预期行为/指标。示例评测通过不等于业务验收完成，不能使用永远返回 0 的命令代替真实评测。
`);
console.log(JSON.stringify({ output, repositories: template.length, candidates, human_reviewed: 0, gold_ready: false }));
