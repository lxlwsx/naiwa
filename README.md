# naiwa-pet

DSH（DeepSeek Harness）插件 `dsh-naiwa-pet`：一只浮在 Harness 页面上的黄色奶娃桌宠，外加本仓库的
测试与验证门禁。插件本身是零依赖的 bundle；仓库根目录的 Node 依赖只服务 lint / format / commit 校验。

执行规则见 [AGENTS.md](AGENTS.md)（提交、测试门禁、依赖部署）。

## 目录

```text
naiwa-pet/          # 可安装的 DSH bundle（宿主半侧 index.js + 浏览器半侧 client.js + 精灵素材）
tests/              # node:test 契约测试（manifest / sprite / 素材路由 / 客户端契约）
scripts/            # 门禁脚本：build、static、secrets、dangerous、verify、hooks 安装
.githooks/          # pre-commit（门禁）、commit-msg（Conventional Commits）
.github/workflows/  # CI：完整 verify
tools/              # 精灵素材重建脚本与预览图（不随插件发布）
```

## 安装插件

```text
plugin_manager install_bundle  target = <仓库绝对路径>/naiwa-pet
```

- 改 `naiwa-pet/assets/*.png` **不需要**重装：宿主路由带 `no-cache + ETag`，刷新页面即取新图。
- 改 `naiwa-pet/client.js` 必须 `remove_bundle` → `install_bundle`，才会加载新的浏览器 JS 代。
- 本插件与 `dsh-pet`（蓝鱼）互不依赖，可同时在场；只想留奶娃就把 `dsh-pet` bundle 关掉。

## 验证门禁

安装依赖（项目内 `node_modules`，锁文件为 `package-lock.json`）：

```text
npm install
```

一键门禁，顺序固定为 `build → test → lint/format → static-analysis → security-check`：

```text
npm run verify
```

也可以单步跑：

```text
npm run build      # 包清单 / 文件白名单 / patch 行 / 素材引用一致性
npm test           # 27 项 node:test（--test-isolation=none，沙箱可用）
npm run lint       # eslint
npm run format:check
npm run static     # 语法、JSON、YAML 形状、PNG 头
npm run security   # 密钥扫描 + 危险原语扫描
```

约定：

- 任何一步失败都不得 commit、不得交付；CI 对 push / PR 跑同一套 `verify`。
- **UI/桌面效果必须人眼确认**：本仓库的自动化只能证明「插件注册成功 + 素材路由可用 + 客户端契约成立」，
  证明不了页面上的实际画面。改动 `client.js` 或素材后，请在运行中的 Harness 页面确认奶娃出现、可拖动、
  会行走、点击有反应，并保留截图作为交付证据。
- 沙箱提示：Git for Windows 的 hooks 需要命名管道，DSH 文件沙箱会拒绝（`Win32 error 5`）。按 AGENTS.md 1.4
  禁止 `--no-verify`，因此在沙箱内提交时对 `git commit` 使用完整访问权限，让 hooks 真实执行。

## 受限网络：`git push` 不可用时

有些机器上 shell 解析不了 `github.com`（浏览器走系统代理能开，但 git/curl 不走），此时普通 push 会失败。
仓库提供两个逃生工具，都只通过可达的 `api.github.com` 工作：

```text
# 1) 诊断 DNS，并给出 hosts 修复建议（--apply 需要管理员权限）
npm run dns:check
npm run dns:check -- --apply

# 2) 用 GitHub Git Data API 把本地提交范围写成远端分支（等价于 push 的内容）
npm run publish:github -- --repo owner/name --branch feat/xxx --from <本地基准sha>
```

约束与保证：

- `publish-github.mjs` **拒绝写入 `main` / `master`**，只创建/更新侧分支，主分支只能通过 PR 合并；
- 认证取 `GH_TOKEN` 或 `gh auth token`，token 不会打印；请求只发往 `https://api.github.com`；
- 真实运行前会校验远端基准分支与本地提交范围（`git merge-base --is-ancestor`）；
- 改名/重命名提交会被 `parseDiff` 明确拒绝，避免把文件路径错配后写坏仓库。

## Git hooks 与分支

```text
npm run hooks:install     # 等价于 git config core.hooksPath .githooks
```

- `pre-commit`：对暂存文件跑密钥扫描，然后跑 `verify --pre-commit`（test/lint/format/static/security）。
- `commit-msg`：commitlint 校验 Conventional Commits（`commitlint.config.mjs`）。
- `main` 只接受合并；日常改动在 `feat/*`、`fix/*` 分支提交，本地 commit 不自动 push。

## 素材

`tools/build_assets.py` 从三视图参考图重建 `naiwa-pet/assets/`（需要 Python + numpy + Pillow）。
默认读取开发机上的附件路径，可用环境变量覆盖：

```text
NAIWA_SRC=<三视图参考图绝对路径> python tools/build_assets.py
```

三帧共用 640×768 画布、同一主体缩放与脚底基线，保证叠放与眨眼交叉淡入不跳动；契约细节见
`naiwa-pet/assets/sprite.json`，并由 `tests/assets.test.mjs` 守护。
