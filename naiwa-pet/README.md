# dsh-naiwa-pet（奶娃桌宠 demo）

一只黄色小奶娃浮在 DeepSeek Harness 页面上：**能拖、会走、会眨眼、被点会撒娇**。
精灵图按用户提供的三视图参考图重新抠制，正面 / 侧面 / 闭眼笑三帧。

## 它现在会做什么

| 能力 | 说明 |
| --- | --- |
| 停在桌面 | 注册进 `shell.overlay`，浮在整个页面之上；只有宠物本体可点，**不挡页面其它操作** |
| 拖动 | 按住拖走，带一点悬挂感和速度倾斜；松手后重力下落、弹跳、落地压扁、扬尘 |
| 行走 | 待机一阵后会自己沿着视口底部走到随机位置（侧面帧 + 摇摆步态，朝右自动镜像） |
| 待机小动作 | 呼吸、随机眨眼（闭眼帧）、偶发小跳 / 原地转圈 / 气泡碎碎念 |
| 互动 | 单击 = 受惊跳一下 + 爱心 + 闭眼笑 + 台词；双击 = 原地转圈 |
| 记住位置 | 位置写 `localStorage`（`dsh-naiwa-pet:pos:v1`），刷新后还在原地；窗口缩放会自动夹回视口内 |

## 结构

```
naiwa-pet/
├─ package.json        # bundle 清单：dsh.bundle.patch + dsh.client（web）
├─ cordis.patch.yml    # 往配置树 insert 一行 dsh-naiwa-pet
├─ index.js            # 宿主半侧：只读素材前缀路由 /dsh-naiwa-pet-7341
├─ client.js           # 浏览器半侧：overlay 浮层 + 宠物状态机（无构建步骤）
├─ locale/{zh,en}.json # 插件管理页的标题/描述
├─ icon.png            # 插件图标
└─ assets/             # 精灵帧（透明 PNG）与 sprite.json 元数据
```

- 宿主路由把 `assets/*.png` 直接交给页面，改图不用重装插件（浏览器缓存 5 分钟 + 弱 ETag）。
- 浏览器半侧是纯 JS：状态机 + `requestAnimationFrame` 积分（重力/行走/弹跳），
  CSS keyframes 负责呼吸、摇摆、压扁、爱心等表现；卸载时清理全部 rAF / timer / listener。
- 文案走 Client locale 服务（命名空间 `naiwa.pet`）。

## 安装

```text
plugin_manager install_bundle  target = <绝对路径>/naiwa-pet
```

安装后若页面没出现奶娃，刷新一次页面。插件是 bundle，改动 `client.js` 后需要重新安装 / 重启以加载新的 JS 代。

## 和 dsh-pet 共存

本插件是独立的 bundle，不会改动 `dsh-pet`（那只蓝色大肥鱼）的任何东西。
两只宠物可以同时在场；不想看到鱼的话，把 `dsh-pet` bundle 关掉即可。

## 调参

- 体型：`client.js` 顶部 `FRAME_W`（默认 168px）
- 步速 / 重力 / 落地弹跳：`WALK_SPEED`、`GRAVITY`、`airStep()` 里的 `0.34`
- 待机频率：`scheduleThink()` 的 `rand(2800, 6400)`
- 台词：`ZH` / `EN` 两张字典

## 素材

`assets/` 由三视图参考图抠制：三帧同画布（640×768）、同主体缩放、同脚底基线，保证叠放与交叉淡入不跳动。
`sprite.json` 里记录画布尺寸、主体包围盒、脚底基线与眼睛位置百分比，方便以后做换装或加帧。
