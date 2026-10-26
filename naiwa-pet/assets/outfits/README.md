# 奶娃换装素材约定（v0.2 outfit contract）

本目录用于给奶娃桌宠添加**可替换服装帧**。放置素材后，用户只需**重启 / 刷新页面**即可生效，
**无需修改 `meta.json` 或 `index.json`**（`frames: []` 会自动探测目录里实际存在的文件）。

## 目录结构

```
naiwa-pet/assets/outfits/
├── index.json                 # 服装清单（插件读取入口，已随包提供）
├── README.md                  # 本文件
├── hanfu-spring/              # 一套服装 = 一个目录
│   ├── README.md
│   ├── meta.json
│   ├── front.png              # 必需
│   ├── front-closed.png       # 可选
│   └── side.png               # 可选
├── hanfu-summer/
├── hanfu-autumn/
└── hanfu-winter/
```

服装目录名固定为 `hanfu-spring` / `hanfu-summer` / `hanfu-autumn` / `hanfu-winter`，
与 `index.json` 中各项的 `dir` 字段一一对应。`classic`（原色）不占用目录，直接使用
`naiwa-pet/assets/` 下的基础帧。

## 文件规格（硬性）

| 项目           | 要求                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| 格式           | PNG（RGBA，8-bit），背景**完全透明**                                         |
| 画布           | `640 × 768`，三帧必须完全一致                                                |
| 主体脚底基线   | `y = 730`（画布坐标，主体最低的不透明像素行）                                |
| 主体包围盒宽度 | `<= 608px`（即左右各留 `>= 16px` / 2.5% 安全边距），不得裁掉脚趾、手、头顶   |
| 主体缩放       | **与基础帧相同**（基础帧 `subject_scale = 1.17375`，主体像素高约 687–689px） |
| 水平位置       | 主体包围盒水平居中于 `x = 320`                                               |
| 白边           | 不允许白边 / 灰白光晕；请在深色与浅色背景上分别检查                          |

> 关键：**同一主体缩放 + 同一脚底基线 + 同一画布**。这样睁眼/闭眼、待机/行走、
> 以及换装交叉淡入（cross-fade）时主体不会跳动。

## 三帧

| 文件               | 必需 | 说明                                                                              |
| ------------------ | ---- | --------------------------------------------------------------------------------- |
| `front.png`        | 是   | 正面、睁眼（用于待机/眨眼底图）                                                   |
| `front-closed.png` | 否   | 正面、闭眼；缺失时自动回退到基础帧 `naiwa-front-closed.png`                       |
| `side.png`         | 否   | 纯侧面、**朝左**（插件在朝右行走时自动镜像）；缺失时回退到基础帧 `naiwa-side.png` |

闭眼帧的眼睛位置必须与 `front.png` 对齐，用于眨眼的交叉淡入。眼位参考值（画布百分比，
与基础帧一致，已记录在各目录的 `meta.json`）：

- 左眼中心：`x = 32.73%`，`y = 25.52%`
- 右眼中心：`x = 67.11%`，`y = 25.39%`

如果你的服装帧头部位置/大小与基础帧一致（推荐直接沿用基础帧的内轮廓），保持上面的眼位即可。

缺失回退规则：`front-closed.png` 缺失 → 用 `naiwa-front-closed.png`；`side.png` 缺失 →
用 `naiwa-side.png`。因此只放 `front.png` 也能工作。

## meta.json

每个服装目录放一个 `meta.json`（UTF-8、2 空格缩进）。示例：

```json
{
  "name": { "zh": "汉服·春", "en": "Hanfu · Spring" },
  "season": "spring",
  "eye_centers_pct": {
    "left": { "x": 32.73, "y": 25.52 },
    "right": { "x": 67.11, "y": 25.39 }
  },
  "frames": []
}
```

字段说明：

- `name`：显示名（`zh` / `en`），用于设置面板与气泡文案。
- `season`：`spring | summer | autumn | winter`（`classic` 为基础帧），插件可据此做季节氛围。
- `eye_centers_pct`：眼位（画布百分比），用于眨眼交叉淡入对齐。
- `frames`：`[]` 表示**自动探测全部三帧并按上述回退规则补全**；也可显式列出已提供的帧，
  例如放入 `front.png` 后写 `["front"]`，或三帧齐全时写 `["front", "front-closed", "side"]`。
  （显式列出时，未列出的帧仍按回退规则使用基础帧。）

放置素材后无需改 `meta.json`：保持 `frames: []` 即可自动生效。

## index.json

`index.json` 是插件读取的服装清单，默认已包含 `classic` 与四套汉服条目：

- `default`：默认服装 id（当前为 `classic`）
- `outfits[].dir`：服装素材目录名；`classic` 的 `dir` 为 `null`（使用基础帧）
- `outfits[].name`：显示名（`zh` / `en`）
- `outfits[].season`：季节标识

新增/删除服装时同步维护该文件；仅替换图片文件不需要改它。

## 生效方式

1. 把 `front.png`（以及可选的 `front-closed.png`、`side.png`）放进对应服装目录；
2. 重启 DSH / 刷新页面（插件只在加载时读取素材清单）；
3. 在宠物设置里选择对应服装。

无需重新构建、无需修改 `index.json` / `meta.json`。
