# naiwa-pet

DSH（DeepSeek Harness）插件 `dsh-naiwa-pet`：一只黄色奶娃桌宠，v0.2 起有**双形态** ——
DSH 页面内的 `shell.overlay` 浮窗，以及 Electron **透明、置顶、不占任务栏**的桌面小窗。
插件本身零运行时依赖；仓库根目录的 Node 依赖只服务构建、lint / format / commit 校验。

执行规则见 [AGENTS.md](AGENTS.md)（提交、测试门禁、依赖部署）。

## 目录

```text
naiwa-pet/          # 可安装的 DSH bundle
  index.js          #   宿主：素材路由 / 配置读写 / 固定 ID 启动器 / 桌面进程托管
  content.js        #   数据：动作、表情、菜单、内置应用
  pet-core.js       #   共享状态机 + 物理 + 表现描述
  src/              #   两套宿主壳源码（构建时内联）
  client.js         #   构建产物（DSH 浏览器半侧）
  desktop/          #   Electron 桌面壳 + 构建产物 pet-app.js
  assets/outfits/   #   换装素材目录（含用户素材契约）
tests/              # node:test 契约测试（含核心状态机、宿主接口、桌面物理）
scripts/            # 门禁脚本：build/client、static、secrets、dangerous、verify、hooks、publish、dns
.githooks/          # pre-commit（门禁）、commit-msg（Conventional Commits）
.github/workflows/  # CI：完整 verify
tools/              # 精灵素材重建脚本与预览图（不随插件发布）
```

## 安装插件

```text
plugin_manager install_bundle  target = <仓库绝对路径>/naiwa-pet
```

- 改 `naiwa-pet/assets/*.png` **不需要**重装：宿主路由带 `no-cache + ETag`，刷新页面即取新图。
- 改 `content.js` / `pet-core.js` / `src/*` 后先 `npm run build`，再 `remove_bundle` → `install_bundle`，
  并刷新页面（模块系统不会热替换已加载的 JS 代）。
- 改 `index.js` 同样需要重新安装。
- 本插件与 `dsh-pet`（蓝鱼）互不依赖，可同时在场；只想留奶娃就把 `dsh-pet` bundle 关掉。

## 桌面形态与配置

```text
npm run desktop:start        # 手动打开桌面小窗（会先把 displayMode 写成 desktop）
```

- 显示位置四态：`app` / `desktop` / `both` / `none`，在右键菜单或 DSH 设置页“桌宠”里切换。
- 配置文件：`$DSH_HOME/dsh-naiwa-pet/config.json`（大小、服饰、动作间隔、自定义应用），
  手动编辑后页面与桌面进程都会热更新。
- Electron 解析顺序：`DSH_NAIWA_ELECTRON_PATH` → `$DSH_HOME/electron` → 包内 `node_modules/electron`。
- 换装素材规格与放置方式见 [naiwa-pet/assets/outfits/README.md](naiwa-pet/assets/outfits/README.md)。
- 完整功能、安全模型与调试自检见 [naiwa-pet/README.md](naiwa-pet/README.md)。

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
npm run build      # 生成 client.js / desktop/pet-app.js + 包清单 / 文件白名单 / 换装素材校验
npm test           # node:test 契约测试（--test-isolation=none，沙箱可用）
npm run lint       # eslint
npm run format:check
npm run static     # 语法、JSON、YAML 形状、PNG 头
npm run security   # 密钥扫描 + 危险原语扫描（audited 例外见脚本注释）
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
