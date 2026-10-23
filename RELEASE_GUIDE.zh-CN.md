# 发布准备与授权边界

2026-10-24 项目所有者已授权创建公开仓库 `valseeee/modeldeps` 并上传完成验证的项目源码。该授权不包含推送发布标签、创建 Release 或发布 npm；这些操作仍需另外明确授权。

## 发布前本地验证

在项目根目录执行 `npm run verify:delivery`。它记录实际测试、构建、benchmark、demo、打包及安装包 smoke 的命令和退出码。核对 `docs/VALIDATION.md`、本地 `reports/round3/DELIVERY.md` 和 RELEASE_CHECKLIST.md。含个人路径的本地 reports/ 不应公开上传，已加入 .gitignore。

必须人工审核：继承的官方快照、当前官方页面、真实仓库许可证和完整 gold set。本轮大陆环境的联网验收由项目所有者豁免，不再反复尝试；宣传可用性之前仍应在官方支持的网络/地区/账户条件下验证 OpenAI 鉴权 API、Anthropic/Gemini 实时抓取。Linux/Windows GitHub CI、独立 consumer 项目调用 composite action 仍待外部验证。未完成时保持实验性描述，不宣传真实准确率。

## 工作流行为

CI：Linux/Windows、只读权限、测试/构建/构造 benchmark/demo/包内容和安装包 smoke；独立 consumer job 实际调用仓库内 composite action，验证健康用例成功、退役用例阻断。所有第三方 Actions 固定完整 commit SHA。

生命周期同步：每周一抓取候选，失败保留原数据；抓取/测试 job 只读，创建 PR 的独立 job 才有写权限；不会自动合并。OpenAI 需要通过 GitHub Secret 配置 Key。网页适配器受地区、网络及改版影响，目前不能声称本环境已实时验证成功。

Release：仅在推送 v*.*.* 标签时触发；只读 prepare job 检查版本匹配、执行验证并打包；独立 publish job 才能写 Release。失败不得进入 publish。未配置 npm 自动发布。

本次源码上传在用户指定的本地项目中进行，不另建项目副本。上传前检查公开文件清单，排除本地报告、凭据、缓存和构建临时文件；上传后核对仓库和远端 CI 的实际结果。不要推送版本标签，也不要执行 Release/npm 发布。之后发布前仍须核对版本、数据来源和所有人工验收项。
