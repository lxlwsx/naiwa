# dsh-naiwa-pet（奶娃桌宠）

一只黄色小奶娃：既能浮在 DeepSeek Harness 页面里，也能放进**透明、置顶、不占任务栏**的桌面小窗。
v0.2 起支持换装、右键功能菜单、动作/表情点播、四态显示位置和设置页。

## v0.2 能做什么

| 能力        | 说明                                                                                    |
| ----------- | --------------------------------------------------------------------------------------- |
| 双形态      | `shell.overlay` 应用内浮窗 + Electron 桌面透明窗，共用同一份状态机与内容表              |
| 拖动 / 甩飞 | 按住拖走；松手后带初速度飞出，撞左右墙反弹（保留 55% 速度）、落地弹跳压扁               |
| 行走        | 应用内沿视口底部走；桌面窗低频整像素移动（避开混合 DPI 屏的窗口缩放问题）               |
| 点击        | 随机播放一个动作（吃/小动作/喝/小情话）+ 闭眼笑 + 爱心 + 气泡；双击原地转圈             |
| 自动动作    | 待机一段时间随机触发动作/转圈/碎碎念，间隔可配置                                        |
| 表情        | 傲娇 / 害羞 / 享受 / 脸红 / 卖萌，叠加层，不占用动作状态机                              |
| 换装        | 原色 + 汉服春夏秋冬；缺帧自动回退基础帧，不白屏                                         |
| 右键菜单    | 动作、服饰、表情、打开应用、显示位置、设置、退出；两形态同一份 `content.js` 数据        |
| 打开应用    | 固定 ID 白名单：DeepSeek 网页端、DSH 本机页面、用户自定义应用；未知 ID 返回 404         |
| 显示位置    | `app` 仅应用内 / `desktop` 仅桌面 / `both` 两者都 / `none` 都不显示                     |
| 设置        | DSH 设置页新增“桌宠”分区：大小、显示位置、服饰、动作间隔、自定义应用 JSON、桌面进程状态 |

## 结构

```
naiwa-pet/
├─ package.json          # bundle 清单：dsh.bundle.patch + dsh.client（web）
├─ cordis.patch.yml      # 往配置树 insert 一行 dsh-naiwa-pet
├─ index.js              # 宿主：素材路由 + 配置读写 + 启动器 + 桌面进程托管
├─ content.js            # 数据：动作 / 表情 / 菜单 / 内置应用 / 气泡文案（ESM）
├─ pet-core.js           # 共享状态机 + 物理 + 表现描述 + CSS（ESM，无 DOM 依赖）
├─ src/
│  ├─ client-shell.js    # DSH 浏览器壳模板（React + 菜单 + 设置页）
│  └─ desktop-renderer.js# 桌面渲染壳（DOM）
├─ client.js             # 构建产物：client-shell + content + pet-core
├─ desktop/
│  ├─ main.cjs           # Electron 主进程：透明置顶窗 / 拖拽 / 物理 / 原生菜单
│  ├─ preload.cjs        # 最小 IPC 桥
│  ├─ pet.html           # 桌面页
│  ├─ pet-app.js         # 构建产物：content + pet-core + desktop-renderer
│  └─ window-physics.cjs # 纯函数窗口物理（可单测）
├─ assets/               # 基础三帧 + sprite.json + outfits/ 换装素材
├─ locale/{zh,en}.json   # 插件管理页标题/描述
└─ icon.png
```

构建：`node scripts/build-client.mjs`（仓库根目录）把 `content.js` / `pet-core.js` 内联进
`client.js` 和 `desktop/pet-app.js`。**不要手改这两个产物**，`npm run verify` 会校验它们与源码一致。

契约层自 v0.1 未变：仍然通过 `window.__ModuleLoader__.load({ id: 'dsh-naiwa-pet' })` 加载，
仍然只向 `shell.overlay` 注册 `id: 'naiwa-pet', order: 1200` 这一个占位，素材仍走
`/dsh-naiwa-pet-7341/assets/*` 前缀路由。

## 配置

配置文件：`$DSH_HOME/dsh-naiwa-pet/config.json`（Windows 默认 `C:\Users\<你>\.dsh\dsh-naiwa-pet\config.json`）。

```json
{
  "displayMode": "app",
  "petSize": 168,
  "activeOutfit": "classic",
  "autoActionInterval": "2800-6400",
  "customApps": [{ "id": "vscode", "label": "VS Code", "type": "exec", "target": "code", "args": [] }]
}
```

- `displayMode`：`app` / `desktop` / `both` / `none`
- `petSize`：80–360，桌面窗与页面内同时生效
- `activeOutfit`：`classic` / `hanfu-spring` / `hanfu-summer` / `hanfu-autumn` / `hanfu-winter`
- `autoActionInterval`：毫秒，可写单值或 `min-max`
- `customApps`：`url` 类型只接受 http(s)；`exec` 类型只按 argv 启动（`shell: false`）

手动编辑该文件后，页面轮询（约 2.5s）与桌面进程的文件监听都会在无需重启的情况下应用。

## 桌面形态

宿主会按 `displayMode` 自动启停桌面进程；也可以手动启动：

```text
npm run desktop:start
```

Electron 解析顺序：`DSH_NAIWA_ELECTRON_PATH` → `$DSH_HOME/electron/electron.exe`（Linux/macOS 对应
可执行文件）→ 包内 `node_modules/electron/dist`。找不到时设置页会显示“未找到 Electron”，
`displayMode: desktop` 会自动回退为应用内，避免把宠物藏没。

桌面窗的窗口位置、抛掷物理、自动溜达都在主进程；渲染页只画宠物并上报手势，宠物状态机仍然是
`pet-core.js` 那一份。

## 换装素材

把图片放进 `assets/outfits/hanfu-<season>/`，规格见 [assets/outfits/README.md](assets/outfits/README.md)：
640×768 透明 PNG、脚底基线 y=730、主体缩放与基础帧一致。`front.png` 必需，`front-closed.png` /
`side.png` 可缺省（自动回退基础帧）。放好后刷新页面即可，不需要改 `meta.json`。

## 安全模型

- 素材是只读 GET；所有改机器状态的 POST（`/config`、`/launch`、`/desktop`、`/ping`）要求
  loopback Host、同源 Origin（若存在）、`X-Naiwa-Pet: 1` 和 `application/json`，浏览器跨站无法伪造。
- `/launch` 只接受固定 ID，未知 ID 返回 404，**绝不把请求内容当命令执行**。
- 桌面进程只用固定 argv 拉起，环境里会删掉 `ELECTRON_RUN_AS_NODE`。

## 安装 / 调试

```text
plugin_manager install_bundle  target = <绝对路径>/naiwa-pet
```

- 改 `assets/*.png`：不用重装，弱 ETag + `no-cache`，刷新即取新图。
- 改 `client.js` / `pet-core.js` / `content.js`：`node scripts/build-client.mjs` 后
  `remove_bundle` → `install_bundle`，并刷新页面。
- 改 `index.js`：同样需要重新安装。
- 自检：`GET /dsh-naiwa-pet-7341/config` 的 `client.part` 是浏览器半侧上报的挂载位置
  （`overlay` / `settings`）；为 `null` 说明页面还没加载到新客户端。
- 桌面形态自检：`desktop.running` 与 `desktop.electron`；窗口的 CDP 检查可用
  `--remote-debugging-port` 手动启动后跑 `.temp` 里的临时脚本（不进仓库）。

## 和 dsh-pet 共存

本插件是独立 bundle，不会改动 `dsh-pet`（那只蓝色大肥鱼）的任何东西。两只宠物可以同时在场。

## ������̬ʵ��

![����͸����ʵ��](assets/preview-desktop.png)

��CDP ץ�Ĵ������ݣ�͸�������������洩͸�����ڱ����ö����ޱ߿򡢲�������������
