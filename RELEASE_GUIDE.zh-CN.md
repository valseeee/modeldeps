# 发布准备与授权边界

2026-10-24 项目所有者已授权创建公开仓库 `valseeee/modeldeps` 并上传完成验证的项目源码。2026-10-25 所有者进一步明确授权推送 v0.4.0 标签、创建 GitHub Release 和发布 npm；无需重复确认。npm 仍需有效账号凭据。

## 发布前本地验证

在项目根目录执行 `npm run verify:delivery`。它记录实际测试、构建、benchmark、demo、打包及安装包 smoke 的命令和退出码。核对 `docs/VALIDATION.md`、本地 `reports/round5/DELIVERY.md` 和 RELEASE_CHECKLIST.md。含个人路径的本地 reports/ 不应公开上传，已加入 .gitignore。

必须人工审核：继承的官方快照、真实仓库许可证和完整 gold set。已准备 35,192 个候选及许可证审核表，以及包含 104 条真实网页记录的 Registry 变更候选。Anthropic/Gemini 已在 GitHub 云端真实抓取成功，OpenAI 鉴权仍待 Key；大陆本地验收继续按所有者豁免。Windows/Linux/macOS CI 各 85/85 测试及独立 consumer 均通过，Release 准备演练已执行；没有业务项目/命令，故真实业务 eval 仍待提供。不得据此宣传真实准确率。

## 工作流行为

2026-10-25 已补充项目许可证、安全报告路径和贡献规范核对；npm 官方 registry 在 2026-10-24 对 `modeldeps-cli` 返回 404，该结果不能当作名称预留或账号发布权限。20 个仓库固定提交的根许可证文本已留存，其中 Autogen 的代码许可单列，Langfuse/LiteLLM/Mastra 存在按目录划分的额外条款；人工分发审核仍保留。本地详细记录见 reports/round6/。真实业务材料可使用 [业务验收表](docs/BUSINESS_ACCEPTANCE.zh-CN.md) 收集。

CI：Windows/Linux/macOS、只读权限、测试/构建/构造 benchmark/demo/包内容和安装包 smoke；独立 consumer 验证健康成功、退役阻断及完整 SHA 的远端 Action 引用。所有第三方 Actions 固定完整 commit SHA。

生命周期同步：每周一抓取候选，失败保留原数据；抓取/测试 job 只读，创建 PR 的独立 job 才有写权限；不会自动合并。OpenAI 需要私下配置 GitHub Secret。另有仅手动触发的 provider-acceptance.yml，只生成独立候选并检查正式 Registry 未改动，不会创建 PR。其 Anthropic 23 / Gemini 81 条记录已实际验证，但不保证每个 IP/地区或未来页面结构可用。

Release：手动 workflow_dispatch 只做只读准备演练，publish 明确跳过；已实际完成一次演练及两个归档校验和检查。只有授权推送 v*.*.* tag，且与 package 版本严格匹配、全部验证和打包成功，独立 publish job 才能写 Release。未配置 npm 自动发布。

本次源码上传在用户指定的本地项目中进行，不另建项目副本。上传前检查公开文件清单，排除本地报告、凭据、缓存和构建临时文件；上传后核对仓库和远端 CI 的实际结果。本次按新授权执行版本标签和 GitHub Release；npm 在有效认证下执行，账号认证失败必须保留真实错误。人工准确率和真实业务验收缺少材料，不作已完成声明。
