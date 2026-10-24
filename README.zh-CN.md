# ModelDeps

面向 AI 模型依赖的本地生命周期检查与迁移评测门禁。版本 0.4.0，需要 Node.js 22+，无运行时 npm 依赖。

## 能力与当前边界

已实现：静态扫描与 provider/surface 身份、生命周期及过期策略、JSON/SARIF/GitHub Summary、人工快照导入、Registry 原子更新、计划重建验证、工作目录输入哈希、eval 执行、精确低风险 patch 与写入失败回滚。

Anthropic/Gemini 官方网页适配器已实现、通过离线测试，并于 2026-10-24 在 [GitHub 云端 Ubuntu 实际联网验证](https://github.com/valseeee/modeldeps/actions/runs/40049987206)，分别解析 23/81 条记录。网页结构仍可能变化；未知行、冲突事实、异常日期和未批准跳转会拒绝更新。大陆本地联网验收继续按所有者要求豁免，不保证全球 IP/账户可用。OpenAI 同步需要 OPENAI_API_KEY，本轮无凭据，未验证鉴权请求。定时工作流是“自动抓取候选 + PR 人工审核更新”；内置历史快照保持原样，真实联网候选等待审核。见 [验证记录](docs/VALIDATION.md)。

真实仓库 benchmark 仅克隆与静态扫描，不安装或执行仓库代码。候选清单不是 gold set；必须由人工标注后才能报告准确率。

## 最短运行说明

Windows PowerShell：先进入解压后的 modeldeps 项目目录，再执行：

```powershell
node --version
npm ci
npm test
npm run benchmark
node dist/cli.js --version
node dist/cli.js check demo/repository/healthy --registry demo/registry.fixture.json
node dist/cli.js check demo/repository/retired --registry demo/registry.fixture.json
```

macOS/Linux 在终端进入项目目录后使用相同命令。退役示例预期退出 1，示例模型均为虚构 fixture。本地 Windows 及远端 Windows/Linux/macOS Node 22 均已实际通过 85/85 测试。

## 迁移与证据

```sh
node dist/cli.js plan demo/repository/migration-breaks-tool-use --registry demo/registry.fixture.json --output .modeldeps/plan.json
node dist/cli.js verify --plan .modeldeps/plan.json --registry demo/registry.fixture.json --command 'node -e "process.exit(1)"' --output .modeldeps/evidence.json
node dist/cli.js apply --plan .modeldeps/plan.json --registry demo/registry.fixture.json
```

示例 eval 故意失败，预期返回 1。实际迁移应使用仓库自己维护的测试/eval；随意运行一个返回 0 的命令并不能证明行为兼容。eval 使用当前用户权限执行，不应运行不可信仓库提供的命令。评测通过仅说明这条命令对记录输入通过，不是所有行为的安全证明。

计划和证据放在 `.modeldeps/`。计划绑定根目录、Registry、规范化配置、配置评测命令与超时、迁移文件及工作目录普通文件；尚未执行的计划标记 pending，真实命令/退出码/输出哈希保存在关联计划哈希的证据中；排除 Git、依赖目录、构建产物、coverage、reports、虚拟环境、软链接和计划本身及其校验文件。外部服务、OS、已安装依赖不在证明范围内。可修改程序和 Registry 的本地管理员仍可伪造本地产物，哈希不是签名信任链。

apply 默认 dry-run，明确 `--write` 才写入。仅对官方、同 surface、精确且无歧义、明确审查为 R0/R1 的替换自动应用；高风险迁移即使 eval 通过也需手动处理。支持 UTF-8/BOM、LF/CRLF/混合换行，拒绝 UTF-16/二进制、只读文件、路径穿越和软链接。先暂存所有修改，写入失败回滚；回滚失败保留原始备份并报告路径。这不是断电情况下的跨文件原子事务，也不保证抵御并发恶意文件系统修改。

## 数据与配置

```sh
node dist/cli.js registry validate
node dist/cli.js registry info
node dist/cli.js registry sync --provider google --live --output .modeldeps/google.json
node dist/cli.js registry sync --provider anthropic --input data/snapshots/anthropic.json --output .modeldeps/anthropic.json
```

联网命令可能退出 3；OpenAI 使用 provider openai 并通过环境变量提供 Key，禁止将 Key 写入仓库。Models API 只列当前可见模型，不代表完整历史；缺失/null 关闭日期不推断 active 或替代关系。失败保留原 Registry，禁用 prune。记录 observed_at、解析器版本、来源/快照哈希和各 Provider 最后成功同步时间。快照 JSON 导入是人工信任边界，不会验证被引用网页。confirmed/tentative/earliest-possible 分开处理；过期不等于退役，verify/apply 拒绝过期或空 Registry。

配置自动读取 `.modeldeps.yml/.yaml/.json`，可用 `--config` 指定。支持 providers、ignore、policy（fail_on、warn_days_before_shutdown、fail_days_before_shutdown、fail_on_unknown、max_source_age_days、require_eval_on）以及 evaluations.default.command/timeout_seconds。默认退役失败，90 天警告、30 天失败、来源 30 天过期；未知模型不默认失败。可用 --strict-unknown / --strict-stale 收紧检查。仅支持基本 YAML 子集，不支持锚点等高级语法。

| 退出码 | 含义 |
| --- | --- |
| 0 | 命令成功或配置评测通过 |
| 1 | 策略/eval 阻断，或 benchmark 缺少必需标注 |
| 2 | 参数、凭据、配置或内部错误 |
| 3 | 来源/联网失败，或真实仓库获取/资源限制失败 |

扫描器支持 TS/JS/Python 及 JSON/YAML/TOML/env/INI/properties/config，属于启发式静态分析；动态变量和模板需要人工审查。默认上限：遍历 50000 项、扫描 250 MB、单文件 10 MB、120 秒；赋值键名支持最多 128 字符，单行最多 1000000 字符；扫描资源超限报错，不能当作扫描通过。

## benchmark 与发布

[标注规则与续跑方法](data/real-repo-benchmark/README.md)。`npm run verify:delivery` 实际运行测试、构建、构造 benchmark、成功/失败 demo、包内容检查及独立安装包 smoke；命令退出码写入 reports/verification/final-commands.json，异常退出非 0，不发布任何内容。

Actions 使用完整 commit SHA；CI 只读并留存执行日志，数据抓取和创建 PR 的写权限分离。三平台完整验证及 consumer 共 6 个 job 均实际成功，见 [CI 记录](https://github.com/valseeee/modeldeps/actions/runs/40049977914)。Release 的手动准备演练已实际通过测试和归档，手动触发不会执行 publish；只有授权版本 tag 才能在校验和准备成功后进入独立发布 job。见 [固定 commit 的调用示例](examples/modeldeps-workflow.yml) 和 [发布清单](RELEASE_CHECKLIST.md)。含个人路径的本地报告不公开上传，tag、Release/npm 仍需另外授权。

故障排查：缺 dist 运行 npm run build；缺依赖运行 npm ci；来源失败查看网络/地区和官方 URL，保留旧库或人工审核快照；输入变化重新生成计划并运行 eval；gold 无效则固定 commit 并填写行列。不得将构造 benchmark 或未标注候选数宣传为真实准确率。

Apache-2.0，见 LICENSE、SECURITY.md。

测试/验证脚本仅在临时副本中刷新合成 fixture 的观察时间，避免固定日期使 CI 日后误报过期；不刷新官方来源日期。benchmark 清单支持显式逐仓库 ignore，报告、固定版本导出和续跑均保留范围，不能把缩小范围的结果写成全仓库通过。[交接文档逐项验收状态](docs/HANDOFF_STATUS.zh-CN.md)。
