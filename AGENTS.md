# AGENTS.md — 项目执行规则

本文件对本仓库内所有由 AI Agent 执行的写操作生效。只读操作（查看、分析、答疑）不受约束。规则按优先级从高到低排列：用户直接指令 > 本文件 > 目录级 AGENTS.md > docs 规范。若规则冲突，以用户当轮明确要求为准，但 commit 与测试门禁不得以“用户没提”为由跳过。

## 1. 提交规则（Commit Discipline）

1.1 每次修改完成，必须创建一个独立 commit。 一个 commit 只对应一个逻辑变更（一个功能、一个修复、一次重构、一次配置变更），禁止把无关改动批量塞进同一个 commit。

1.2 实现顺序固定为：改 → 验证 → commit → 进入下一项。 不得等会话结束或一批改动做完再统一提交；每个逻辑变更完成后立即本地 commit，但不自动 push（push 需用户明确指令）。

1.3 commit message 必须遵循 Conventional Commits，格式 `<type>(<scope>): <description>`，header 不超过 120 字符、祈使语气、不以句号结尾；必要时把细节放 body。常用 type：

| type | 用途 |
| --- | --- |
| feat | 新功能 |
| fix | 修复 bug |
| test | 新增或修改测试 |
| refactor | 重构（不改变行为） |
| docs | 仅文档 |
| chore | 工具、依赖、配置维护 |
| perf | 性能优化 |
| revert | 回滚某次提交 |

1.4 禁止使用 `--no-verify` 绕过 pre-commit / commit-msg hook。 hook 报错时修代码或修配置，不得绕过；禁止 force push 到共享分支。

1.5 commit 前必须自查 staged 内容，确认没有把密钥、临时文件、调试代码、无关文件带进去。建议在 commit body 留一行 `Refs: <issue/任务标识>` 便于回滚追溯。

## 2. 测试与验证门禁（Test & Verification Gate）

2.1 每次修改后，必须编写或更新对应的测试。 新增功能要有覆盖新行为的测试；修复 bug 要先写一个能复现该 bug 的失败测试，确认它失败（RED），再改代码让它通过（GREEN），最后重构（REFACTOR）。

2.2 在把结果交互给用户之前，必须确保所有测试和验证全部通过。 至少依次通过：

```text
build → test → lint/format → static-analysis → security-check
```

任何一项失败 = 停止，不允许 commit，更不允许交付。

2.3 不得以“测试环境跑不起来”为由跳过测试。 先按第 3 节自行补齐环境；确实无法补齐时，向用户说明缺什么、卡在哪一步，而不是直接交付未验证的结果。

2.4 验证必须留下证据。 交付时给出：测试命令、通过结果、关键日志或截图（涉及 UI/桌面窗口时必须实际看到效果，不能只看代码推断）。只跑通单测但没验证真实交互路径的，不算通过。

2.5 基线失败优先处理。 如果动手前发现基线测试就是红的，先停下来定位并报告，不得在红基线上继续叠加改动。

## 3. 缺失资源自主部署（Autonomous Environment Setup）

3.1 执行中缺少依赖、工具、运行时，直接自行安装，不要停下来等用户批准。 按以下顺序处理：

1. 先看仓库里有没有依赖清单：package.json、requirements.txt、pyproject.toml、Gemfile、Cargo.toml 等。有就用它一次性装全（npm install、pip install -r requirements.txt 等）。
2. 没有依赖清单，或只缺个别包，再单独安装（npm i <pkg>、pip install <pkg>、apt-get install <pkg> 等）。
3. 装完后重跑刚才失败的命令，确认问题消失。

3.2 部署行为必须限定在项目沙箱/虚拟环境内。 Python 用 venv，Node 用项目本地 node_modules，不往系统全局乱装；需要 sudo 的包安装操作，先判断是否真的必要，非必要不执行。

3.3 以下情况必须停下来问用户，不得自主执行： 卸载或降级已有依赖、修改系统级配置、开放额外网络出站、安装来源不明的包、执行会删除数据或影响项目外文件的命令。

3.4 新增的依赖要锁定版本并提交依赖清单的变更，commit 类型用 `build:` 或 `chore:`。

## 4. 执行检查清单（每次任务收尾前逐项确认）

- [ ] 改动是单一逻辑变更，已独立 commit，message 符合 Conventional Commits
- [ ] 对应测试已新增/更新，且全部通过
- [ ] build / lint / static-analysis / security-check 全绿
- [ ] 没有使用 `--no-verify`，没有 force push
- [ ] 没有把密钥、临时文件、调试代码带进提交
- [ ] 交付说明里附了验证命令和通过证据；UI/桌面类改动附了实际效果证据
- [ ] 缺失依赖已在项目内自主补齐，未做越权系统操作

## 补充约定（仓库落地补充，优先级低于以上编号条款）

- commit 前自动跑敏感信息扫描（本地 `scripts/scan-secrets.mjs`），拦截密钥、连接串、token。
- 禁止在 `main` / `master` 上直接提交：Agent 动手前先切 feature 分支，主分支只接受合并。
- 强制“先证据后结论”：涉及“已修复”“已通过”“已验证”的表述，必须能指到具体命令输出或截图。
- 失败要留痕而不是静默重试：测试或安装失败时，把错误摘要和尝试过的命令记下来；连续两次同类失败就停下来报告。
- 临时文件固定放 `.temp/` 或系统临时目录，任务结束前清理；禁止把调试脚本、草稿、日志留在源码目录里被误提交。
- 大改动拆成多个原子任务：每个原子任务单独走“测试 → commit”循环。
- 门禁实现：`pre-commit` 跑静态扫描 + 单测 + lint/format，`commit-msg` 跑 Conventional Commits 校验，CI 跑完整 `verify`（build/test/lint/format/static/security）。
