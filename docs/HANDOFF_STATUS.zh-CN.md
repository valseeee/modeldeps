# 后续补丁状态（2026-10-25）

0.4.1 修复 benchmark 续跑错误归属：增加未跟踪或 Git 忽略的本地文件时也拒绝扫描/续跑。原版两个场景均错误成功，修复后相关 6 项测试全部通过。以下表格保留 0.4.0 的逐项基线，最新补丁证据见 reports/round8。既有 20 仓库历史范围与人工 gold 状态未改变。

发布收尾更新：2026-10-26。0.4.1 的完整测试为 86/86，三平台测试及 consumer 共六个 job 成功；[GitHub Release](https://github.com/valseeee/modeldeps/releases/tag/v0.4.1) 已公开。[npm 的 modeldeps-cli@0.4.1](https://www.npmjs.com/package/modeldeps-cli/v/0.4.1) 已于 2026-10-25 发布，latest 指向 0.4.1；从官方 registry 独立安装后的版本查询和 169 条 Registry 校验均退出 0。发布及安装原始结果见 reports/round9；不再存在等待 npm 登录的发布阻塞。

# 交接文档逐项落实状态

更新：2026-10-24。依据项目根目录 CODEX_HANDOFF_ModelDeps_v0.4.0.md 的阶段与编号对应。实际命令/退出码见本地 reports/verification 与 reports/round5；公开发布不附带个人路径日志。

本次中国大陆网络环境访问受限，项目所有者已明确豁免当地真实联网验收；这不是对所有其他地区/账户的可用性保证。功能和离线测试已实现，其他地区需符合官方支持范围和访问条件。

## A 建立基线

| 条款 | 状态 | 实施与证据 |
| --- | --- | --- |
| A1 | 完成 | 项目结构、package/lock/tsconfig/dist 与完整 ZIP 均已核查。 |
| A2 | 完成 | 源码、Provider、Registry、tests、workflows 已直接检查并修改。 |
| A3 | 完成 | 实际运行版本、构建、测试、构造 benchmark、demo 和打包/安装 smoke。 |
| A4 | 完成 | 原始命令/环境/退出码在 reports；失败日志保留，最终结果另列。 |
| A5 | 完成 | 首次原始基线 44/45；本轮本地及远端 Linux/Windows/macOS 均为 85/85，原始失败和修复后的记录均保留。 |

## B 生命周期真实性与同步

| 条款 | 状态 | 实施与证据 |
| --- | --- | --- |
| B1 | 两家真实联网通过；OpenAI 待凭据 | GitHub 云端实际抓取 Anthropic 23 / Gemini 81 条并校验候选；OpenAI 官方可选/null shutdown_date schema 已核对，鉴权请求因无 Key 未验证。大陆本地豁免保留。 |
| B2 | 完成 | confirmed/tentative/earliest-possible 与 unknown 分开；不把最早日期当作已关闭。 |
| B3 | 完成；历史版本未知明确标注 | 来源 URL/observed_at/内容或快照 hash/完整身份与语义均保存；新解析器记录版本，旧记录仅标 legacy-unrecorded，不伪造日期或旧版本。 |
| B4 | 完成 | 逐跳官方 HTTPS 校验、重定向次数、MIME、流式大小、超时、表结构、行数与 API 分页漂移拒绝。 |
| B5 | 完成 | HTTP/登录或地区墙/空表/异常结构均失败关闭；不覆盖现有 Registry。 |
| B6 | 完成 | 同目录唯一临时文件、重新 schema 校验后 rename 替换。业务回归由 tests/CI 执行，完整 workflow 通过后才可提 PR。 |
| B7 | 完成 | 仅增量合并，prune 明确禁用；不把解析缺失当作删除依据。 |
| B8 | 完成 | 文档明确自动抓取候选 + PR 人工审核，不称实时数据库。 |
| B9 | 完成 | 正常/空/改版/重复/非法日期/错误重定向/状态码/过大/超时/缺失替代等 fixture 已实际执行。 |
| B10 | 完成 | 逐 Provider last_successful_sync 与来源 observed_at；过期和未来时间均阻断迁移，stale 不等于退役。 |

## C 真实仓库 benchmark

| 条款 | 状态 | 实施与证据 |
| --- | --- | --- |
| C1 | 固定提交文本核对完成；人工分发判断待办 | 20 个真实仓库：14 完整 + 6 显式稀疏 checkout；20/20 根许可证及 Autogen/Langfuse 附加文本已读取并留存，混合目录条款见 reports/round6；human_approved 保持 false。 |
| C2 | 20 项均有明确范围证据 | 固定 20 个完整 commit SHA、记录时间/实现/Registry/范围；6 项只在显式稀疏范围内成功，历史全仓资源失败保留。 |
| C3 | 完成 | 只执行 Git/静态扫描；不安装或执行目标代码，禁 hooks/LFS smudge。 |
| C4 | 完成；明确资源边界 | 超时、进程树终止、磁盘/文件数量采样与扫描预算、checkpoint 和续跑。不是 OS 硬配额；失败 staging 保留供人工处理。 |
| C5 | 完成 | 35,192 个待审候选，含固定 commit 原文链接、位置/身份/规则/上下文；CSV、JSON 和进度表保持 reviewed:false。 |
| C6 | 完成 | 标注规则区分实际依赖、文档、fixture、注释、动态变量/模板与负例。 |
| C7 | 实现；等待人工 gold | 固定 commit、明确人工确认后才评分；未标注不计正确，真实 TP/FP/FN/precision/recall/F1 为 N/A。 |
| C8 | 实现并用 fixture 验证 | 分语言/文件类型/Provider/框架元数据评分，包含 FP/FN 定位；无真实 gold 不造指标。 |
| C9 | 完成 | 已有报告默认禁止覆盖；显式 resume 校验 commit、实现、Registry、预算和逐仓 ignore/sparse_paths。 |
| C10 | 完成 | 原 20 项均有范围明确的扫描：12 默认 + 2 显式排除 + 6 显式稀疏；不把稀疏结果混为全仓成功。 |

## D 迁移证据链与 eval gate

| 条款 | 状态 | 实施与证据 |
| --- | --- | --- |
| D1 | 完成（不可变计划 + 执行证据） | 计划含 schema/时间/root/完整身份/来源/风险/必需门禁、配置命令/超时及 pending；真实命令、exit code、输入输出 hash 在关联 plan hash 的 evidence 中，不提前编造执行结果。 |
| D2 | 完成 | verify/apply 重建策略与位置，校验 Registry、root、工作目录、config、计划原始字节及可用的 SHA sidecar。 |
| D3 | 完成 | 高风险缺少/失败 eval、篡改、过期/未来时间、源/目标缺失 hash、目标非 active、非官方替代均阻断。 |
| D4 | 完成 | 证据只由实际执行生成，记录计划/输入状态；不接受 passed:true 作为导入凭证。 |
| D5 | 完成 | 输出明确限定为配置评测通过，不是所有输入/部署行为的证明。 |
| D6 | 完成 | 默认 dry-run；仅精确且明确低风险、无需 eval 的官方同 surface 替换可自动应用。 |
| D7 | 完成 | BOM/CRLF/LF/混合换行、UTF-16 拒绝、只读、软链接、路径穿越与仓库外路径均有对应校验。 |
| D8 | 完成 | 篡改计划/缺失或失败 eval/输入与 Registry 变化/路径/部分写入失败回滚均已测试；不承诺断电时跨文件原子性。 |
| D9 | 完成 | JSON/Markdown evidence；实际 SARIF 通过完整 JSON Schema 与定位测试。 |

## E CLI / Actions / 供应链

| 条款 | 状态 | 实施与证据 |
| --- | --- | --- |
| E1 | 完成 | 0 成功；1 策略/eval/标注阻断；2 参数/配置/凭据/内部错误；3 来源/网络/资源失败。 |
| E2 | 完成 | 来源有超时、大小限制与清晰错误；不静默返回无问题。 |
| E3 | 完成 | 只读扫描/测试 job contents:read。 |
| E4 | 完成 | fork PR 无写 job/secrets；发布仅授权 tag，生命周期仅 schedule/manual。 |
| E5 | 完成 | 抓取与创建 PR、准备与发布的写权限 job 分离，不自动合并。 |
| E6 | 完成 | Actions 均已用 API 核验的完整 SHA 固定，并在发布清单要求复查。 |
| E7 | 三平台已远端执行 | 0.4.0 基线 85/85；0.4.1 为 86/86，三平台完整验证与 consumer 共 6 job 成功，证据见 reports/round8。 |
| E8 | 正式 Release 已发布 | 手动演练跳过 publish；正式匹配 tag 经完整验证后，prepare/publish 均成功，v0.4.0 和 v0.4.1 Release 已公开。不匹配 tag/分支事件有拒绝回归。 |
| E9 | 源码、Release、npm 已发布 | 按所有者的后续明确授权执行；npm CLI 登录和发布二次验证均成功，0.4.1 已在官方 registry 公开，独立安装 smoke 通过，见 reports/round9。 |
| E10 | 完成（模式检查边界） | npm 白名单排除 tests/reports/.env/cache；检查已知 token、个人路径与大文件。完整本地 ZIP 的审计日志不应原样公开上传。 |

## F 文档与体验

| 条款 | 状态 | 实施与证据 |
| --- | --- | --- |
| F1 | 完成 | 中英文 README 与当前实现一致；历史文档说明由当前状态覆盖。 |
| F2 | 完成 | 区分实现、实验性、凭据、当地联网豁免、人工审核及外部验收；不保证所有境外 IP 可用。 |
| F3 | 三平台已执行 | Windows/Linux/macOS Node 22 完整验证与 consumer 均实际通过。 |
| F4 | 完成 | 最短健康/退役/eval 失败 demo、配置字段、退出码与故障排查。 |
| F5 | 已执行可授权路径 | 三平台 CI、两家 Provider 真抓取、源码上传、正式 Release/npm 和 npm 独立安装均有实际证据；OpenAI 无 Key，鉴权路径仍未执行。 |
| F6 | 完成 | 无接近 100% 的真实准确率或三家实时已验证承诺；构造样例与真实清单分开报告。 |

## 仍需人工或外部环境完成的事项

- 人工核验继承的官方快照、仓库许可证，标注真实 gold set；不能由自动生成的候选替代人工。
- OpenAI 鉴权同步仍需私下配置 Key；Anthropic/Gemini 已在 GitHub 云端实际通过，仍不保证所有网络/地区/账户可用。大陆本地豁免保留。
- 6 项历史全仓预算失败保留；同仓的显式稀疏代码范围已经实际通过，不能据此声称全仓验证。
- 所有者目前没有业务 eval 或人工 gold 材料；已提供完整待审核包和官方 Registry 变更候选。另已固定 BANKING77 公共数据提交及 20 条原始标注输入，作为参考评测准备材料；没有运行模型，指标仍为 null，不能替代所有者的业务验收。tag、正式 Release 与 npm 已发布。

## 明确不作的保证

采样磁盘监控不是 OS 硬配额；补丁回滚不是崩溃原子事务；输入 hash 不覆盖外部服务/OS/排除目录，也不是签名证明；启发式扫描不保证动态引用全覆盖。对这些边界保持说明，不以关闭断言、删除失败项或伪造指标达成验收。
