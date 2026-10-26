/** 生成产物：不要手改。源码见 naiwa-pet/src/desktop-renderer.js + content.js + pet-core.js。 */
(function () {
'use strict';
/**
 * 奶娃桌宠 —— 内容数据（动作 / 表情 / 菜单 / 内置应用）。
 *
 * 纯数据、无副作用、不依赖 DSH 或 Electron：DSH 浏览器半侧、桌面 Electron 壳
 * 和 Node 单测共用这一份内容表，避免三套数据各自漂移。
 *
 * 每个可见文案都写 `{ zh, en }`，适配层自己决定用哪一语言（DSH 走 locale 服务，
 * 桌面壳体走系统 locale）。`bubble` 是气泡文案的 key，由 core 交给适配层翻译。
 */

/** 可自动触发 / 可手动点播的动作。effect 由适配层映射成 CSS 动画。 */
const ACTIONS = {
  eat: {
    id: 'eat',
    label: { zh: '吃什么', en: 'Eat' },
    bubble: 'bubble.action.eat',
    duration: 2400,
    effect: 'nod',
    hearts: false,
    auto: true,
  },
  idle: {
    id: 'idle',
    label: { zh: '待机', en: 'Idle' },
    bubble: '',
    duration: 0,
    effect: 'none',
    hearts: false,
    auto: false,
  },
  'small-move': {
    id: 'small-move',
    label: { zh: '小动作', en: 'Little move' },
    bubble: 'bubble.action.small-move',
    duration: 1800,
    effect: 'wiggle',
    hearts: false,
    auto: true,
  },
  drink: {
    id: 'drink',
    label: { zh: '喝什么', en: 'Drink' },
    bubble: 'bubble.action.drink',
    duration: 2200,
    effect: 'nod',
    hearts: false,
    auto: true,
  },
  'sweet-talk': {
    id: 'sweet-talk',
    label: { zh: '小情话', en: 'Sweet talk' },
    bubble: 'bubble.action.sweet-talk',
    duration: 2600,
    effect: 'sway',
    hearts: true,
    auto: true,
  },
};

/** 菜单 / 随机动作用的动作顺序（不含 idle）。 */
const ACTION_ORDER = ['eat', 'small-move', 'drink', 'sweet-talk'];

/** 表情是叠加层：不占用状态机，到点自动消失。 */
const EXPRESSIONS = {
  tsundere: {
    id: 'tsundere',
    label: { zh: '傲娇', en: 'Tsundere' },
    bubble: 'bubble.expression.tsundere',
    face: 'front-closed',
    effect: 'shake',
    duration: 2200,
  },
  shy: {
    id: 'shy',
    label: { zh: '害羞', en: 'Shy' },
    bubble: 'bubble.expression.shy',
    face: 'front-closed',
    effect: 'blush',
    duration: 2400,
  },
  enjoy: {
    id: 'enjoy',
    label: { zh: '享受', en: 'Enjoy' },
    bubble: 'bubble.expression.enjoy',
    face: 'front-closed',
    effect: 'sway',
    duration: 2600,
  },
  blush: {
    id: 'blush',
    label: { zh: '脸红', en: 'Blush' },
    bubble: 'bubble.expression.blush',
    face: 'front',
    effect: 'blush',
    duration: 2600,
  },
  cute: {
    id: 'cute',
    label: { zh: '卖萌', en: 'Cute' },
    bubble: 'bubble.expression.cute',
    face: 'front',
    effect: 'bounce',
    duration: 2600,
    scale: 1.06,
  },
};

/** 显示位置四态：DSH 内 / 桌面窗 / 两者都 / 两者都不。 */
const POSITION_MODES = [
  { id: 'app', label: { zh: '仅应用内', en: 'In app only' } },
  { id: 'desktop', label: { zh: '仅桌面', en: 'Desktop only' } },
  { id: 'both', label: { zh: '两者都显示', en: 'Both' } },
  { id: 'none', label: { zh: '都不显示', en: 'Hidden' } },
];

/**
 * 内置应用：只放固定 ID + 固定目标，宿主侧只按 ID 查表，绝不执行用户传入的命令。
 * url 类型用系统默认浏览器打开，exec 类型只能来自用户自己写的配置文件。
 */
const BUILTIN_APPS = [
  {
    id: 'deepseek-web',
    label: { zh: 'DeepSeek 网页端', en: 'DeepSeek Web' },
    type: 'url',
    target: 'https://chat.deepseek.com',
  },
  {
    id: 'dsh-local',
    label: { zh: 'DeepSeek Harness', en: 'DeepSeek Harness' },
    type: 'url',
    target: 'http://127.0.0.1:62987',
  },
];

/** 菜单数据：两个形态共用，点击行为由各自的适配层解释。 */
const MENU = [
  { id: 'actions', kind: 'actions', label: { zh: '动作', en: 'Actions' } },
  { id: 'outfits', kind: 'outfits', label: { zh: '服饰', en: 'Outfits' } },
  { id: 'expressions', kind: 'expressions', label: { zh: '表情', en: 'Expressions' } },
  { id: 'apps', kind: 'apps', label: { zh: '打开应用', en: 'Open app' } },
  { id: 'position', kind: 'position', label: { zh: '显示位置', en: 'Display' } },
  { id: 'settings', kind: 'settings', label: { zh: '桌宠设置', en: 'Pet settings' } },
  { id: 'quit', kind: 'quit', label: { zh: '退出', en: 'Quit' } },
];

/**
 * 气泡文案表：core 只发 key，适配层各自翻译。
 * DSH 半侧把它们注册进 locale 字典；桌面壳直接按系统语言挑 zh/en。
 */
const BUBBLE_TEXT = {
  'bubble.greet': { zh: '奶娃来啦～', en: 'Naiwa is here!' },
  'bubble.idle.1': { zh: '摸鱼中…', en: 'Slacking off…' },
  'bubble.idle.2': { zh: '今天也要加油鸭', en: 'You can do it today!' },
  'bubble.idle.3': { zh: '抱抱我嘛', en: 'Hug me?' },
  'bubble.idle.4': { zh: '肚子有点饿了', en: 'A little hungry…' },
  'bubble.idle.5': { zh: '我就在这儿陪你', en: 'I am right here with you' },
  'bubble.click.1': { zh: '呀！被摸头了～', en: 'Ah! Head pats!' },
  'bubble.click.2': { zh: '嘿嘿，好痒', en: 'Hehe, that tickles' },
  'bubble.click.3': { zh: '再摸一下嘛', en: 'One more pat?' },
  'bubble.walk': { zh: '我出去溜达一圈', en: 'Off for a little walk' },
  'bubble.drag': { zh: '放我下来啦～', en: 'Put me down~' },
  'bubble.drop': { zh: '哎哟喂～', en: 'Oof!' },
  'bubble.action.eat': { zh: '好好吃～', en: 'Yummy~' },
  'bubble.action.small-move': { zh: '伸个懒腰～', en: 'Big stretch~' },
  'bubble.action.drink': { zh: '咕嘟咕嘟', en: 'Glug glug' },
  'bubble.action.sweet-talk': { zh: '最喜欢你啦', en: 'I like you the most' },
  'bubble.expression.tsundere': { zh: '哼，才不是呢', en: 'Hmph, no I am not' },
  'bubble.expression.shy': { zh: '别、别看我啦', en: 'D-don’t look at me' },
  'bubble.expression.enjoy': { zh: '好舒服呀', en: 'So comfy' },
  'bubble.expression.blush': { zh: '脸好烫…', en: 'My face is hot…' },
  'bubble.expression.cute': { zh: '快夸我！', en: 'Praise me!' },
};

/** 待机碎碎念的文案 key（翻译在 locale 字典里）。 */
const IDLE_BUBBLES = ['bubble.idle.1', 'bubble.idle.2', 'bubble.idle.3', 'bubble.idle.4', 'bubble.idle.5'];

/** 点击时随机挑一句回应。 */
const CLICK_BUBBLES = ['bubble.click.1', 'bubble.click.2', 'bubble.click.3'];

const WALK_BUBBLE = 'bubble.walk';
const DRAG_BUBBLE = 'bubble.drag';
const DROP_BUBBLE = 'bubble.drop';
const GREET_BUBBLE = 'bubble.greet';

/** 点击时随机挑一个“有表现”的动作；idle 不参与随机。 */
function randomActionId(random) {
  const roll = (typeof random === 'function' ? random : Math.random)();
  return ACTION_ORDER[Math.min(ACTION_ORDER.length - 1, Math.floor(roll * ACTION_ORDER.length))];
}

/**
 * 取一个带语言的文案，兼容 `{zh,en}`、字符串和 undefined。
 * @param {{zh?: string, en?: string}|string|undefined} label
 * @param {'zh'|'en'} lang
 */
function labelOf(label, lang) {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[lang] ?? label.zh ?? label.en ?? '';
}
/**
 * 奶娃桌宠 —— 共享核心（状态机 + 物理 + 表现描述）。
 *
 * 这一份代码被三种宿主共用：
 *   - DSH 浏览器半侧（构建时内联进 client.js）
 *   - 桌面 Electron 渲染页（构建时内联进 desktop/pet-app.js）
 *   - Node 单元测试（直接 ESM import）
 *
 * 它不碰 DOM、不碰 React、不碰 Electron：每帧通过 onPaint(view) 把一份纯数据
 * 表现描述交给适配层，适配层负责把它写成 CSS/transform。气泡文案、爱心粒子、
 * 压扁/转圈等瞬时事件分别走 onBubble / onBurst / onEvent 回调。
 *
 * 两种运动驱动：
 *   - motion: 'dom'      —— 在浏览器视口里自己积分重力、走位、撞墙反弹
 *   - motion: 'external' —— 桌面窗形态：窗口位置由 Electron 主进程移动，
 *     这里只负责手势识别、动作/表情/眨眼和表现事件
 */

const CORE_VERSION = 2;
const FRAME_NAMES = ['front', 'front-closed', 'side'];
const DEFAULT_FRAME_RATIO = 768 / 640;

/** 宠物本体 CSS。菜单/设置面板的样式属于适配层，不在这里。 */
const PET_CSS = `
.naiwa-layer{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:2147483000;contain:layout style}
.naiwa-shadow{position:absolute;left:0;top:0;width:112px;height:18px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.36) 0%,rgba(0,0,0,.15) 45%,rgba(0,0,0,0) 72%);filter:blur(1.5px);pointer-events:none;will-change:transform,opacity}
.naiwa-stage{position:absolute;left:0;top:0;pointer-events:none;will-change:transform}
.naiwa-flip,.naiwa-tilt,.naiwa-body{position:absolute;inset:0;transform-origin:50% 96%}
.naiwa-body{pointer-events:none}
.naiwa-img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;pointer-events:none;-webkit-user-drag:none;user-select:none;transition:opacity .1s linear}
.naiwa-side,.naiwa-closed{opacity:0}
.naiwa-body[data-face="side"] .naiwa-front{opacity:0}
.naiwa-body[data-face="side"] .naiwa-side{opacity:1}
.naiwa-body[data-face="closed"] .naiwa-closed{opacity:1}
.naiwa-body[data-mode="idle"]{animation:naiwa-breathe 3.6s ease-in-out infinite}
.naiwa-body[data-mode="walk"]{animation:naiwa-walk .46s ease-in-out infinite}
.naiwa-body[data-mode="drag"]{animation:naiwa-dangle 1.9s ease-in-out infinite}
.naiwa-body.is-squash{animation:naiwa-squash .24s ease-out}
.naiwa-body.is-spin{animation:naiwa-spin .8s ease-in-out}
.naiwa-body.is-hop{animation:naiwa-hop .42s ease-out}
.naiwa-body[data-action="nod"]{animation:naiwa-nod .5s ease-in-out 3}
.naiwa-body[data-action="wiggle"]{animation:naiwa-wiggle .3s ease-in-out 5}
.naiwa-body[data-action="sway"]{animation:naiwa-sway .7s ease-in-out 3}
.naiwa-body[data-action="shake"]{animation:naiwa-shake .32s ease-in-out 5}
.naiwa-body[data-action="bounce"]{animation:naiwa-bounce .5s ease-in-out 4}
.naiwa-body[data-expression="blush"] .naiwa-blush{opacity:1}
.naiwa-body[data-expression="shy"] .naiwa-blush{opacity:1}
.naiwa-blush{position:absolute;inset:0;opacity:0;transition:opacity .2s ease;pointer-events:none}
.naiwa-blush::before,.naiwa-blush::after{content:"";position:absolute;top:24%;width:12%;height:5%;border-radius:50%;background:radial-gradient(ellipse at center,rgba(244,116,116,.62) 0%,rgba(244,116,116,0) 72%);filter:blur(1px)}
.naiwa-blush::before{left:24%}
.naiwa-blush::after{right:24%}
.naiwa-hit{position:absolute;inset:0;pointer-events:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
.naiwa-stage.is-dragging .naiwa-hit{cursor:grabbing}
.naiwa-bubble{position:absolute;left:50%;bottom:88%;transform:translate(-50%,4px);max-width:230px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:6px 10px;border-radius:12px;background:rgba(255,252,244,.96);color:#4a3a1c;font:500 12px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:0;transition:opacity .16s ease,transform .16s ease;pointer-events:none}
.naiwa-bubble.show{opacity:1;transform:translate(-50%,-4px)}
.naiwa-bubble::after{content:"";position:absolute;left:50%;bottom:-5px;width:10px;height:10px;margin-left:-5px;background:rgba(255,252,244,.96);border-radius:2px;transform:rotate(45deg)}
.naiwa-fx{position:absolute;inset:0;pointer-events:none;overflow:visible}
.naiwa-heart{position:absolute;line-height:1;animation:naiwa-float 1.15s ease-out forwards;will-change:transform,opacity}
.naiwa-dust{position:absolute;bottom:1%;border-radius:50%;background:rgba(150,128,86,.42);animation:naiwa-dust .55s ease-out forwards}
@keyframes naiwa-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.014,.984) translateY(.6%)}}
@keyframes naiwa-walk{0%{transform:rotate(-5deg) translateY(0) scale(1.02,.98)}25%{transform:rotate(0deg) translateY(-5px) scale(.992,1.008)}50%{transform:rotate(5deg) translateY(0) scale(1.02,.98)}75%{transform:rotate(0deg) translateY(-5px) scale(.992,1.008)}100%{transform:rotate(-5deg) translateY(0) scale(1.02,.98)}}
@keyframes naiwa-dangle{0%,100%{transform:rotate(-3.5deg) translateY(-1px)}50%{transform:rotate(3.5deg) translateY(2px)}}
@keyframes naiwa-spin{0%{transform:rotate(0deg) scale(1,1)}55%{transform:rotate(200deg) scale(.94,1.04)}100%{transform:rotate(360deg) scale(1,1)}}
@keyframes naiwa-squash{0%{transform:scale(1,1)}28%{transform:scale(1.16,.82) translateY(3%)}62%{transform:scale(.94,1.07)}100%{transform:scale(1,1)}}
@keyframes naiwa-hop{0%{transform:translateY(0) scale(1,1)}35%{transform:translateY(-9px) scale(.97,1.04)}70%{transform:translateY(0) scale(1.06,.94)}100%{transform:translateY(0) scale(1,1)}}
@keyframes naiwa-nod{0%,100%{transform:rotate(0deg)}35%{transform:rotate(0deg) translateY(3%)}70%{transform:rotate(0deg) translateY(-1%)}}
@keyframes naiwa-wiggle{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg) translateY(-1px)}}
@keyframes naiwa-sway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes naiwa-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
@keyframes naiwa-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes naiwa-float{0%{opacity:0;transform:translate(-50%,0) scale(.5)}18%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),-74px) scale(1.12)}}
@keyframes naiwa-dust{0%{opacity:.65;transform:translate(-50%,0) scale(.5)}100%{opacity:0;transform:translate(calc(-50% + var(--dx,0px)),-10px) scale(1.5)}}
`;

const DEFAULT_IDLE_BUBBLES = ['bubble.idle.1', 'bubble.idle.2', 'bubble.idle.3', 'bubble.idle.4'];
const DEFAULT_CLICK_BUBBLES = ['bubble.click.1', 'bubble.click.2', 'bubble.click.3'];
const DEFAULT_WALK_BUBBLE = 'bubble.walk';
const DEFAULT_DRAG_BUBBLE = 'bubble.drag';
const DEFAULT_DROP_BUBBLE = 'bubble.drop';
const DEFAULT_GREET_BUBBLE = 'bubble.greet';

const noop = () => {};

function finite(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** 把 2800 / "2800-6400" / [2800, 6400] 统一成 [min, max]。 */
function parseInterval(value, fallback = [2800, 6400]) {
  if (Array.isArray(value) && value.length === 2) {
    const min = Math.max(400, finite(Number(value[0]), fallback[0]));
    const max = Math.max(min, finite(Number(value[1]), fallback[1]));
    return [min, max];
  }
  if (typeof value === 'string') {
    const parts = value.split('-').map((part) => Number(part.trim()));
    if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
      const min = Math.max(400, parts[0]);
      return [min, Math.max(min, parts[1])];
    }
    const single = Number(value);
    if (Number.isFinite(single)) return [Math.max(400, single), Math.max(400, single)];
  }
  if (typeof value === 'number' && Number.isFinite(value)) return [Math.max(400, value), Math.max(400, value)];
  return [fallback[0], fallback[1]];
}

function frameUrls(assetBase, outfit, frameName) {
  if (outfit && typeof outfit === 'object' && outfit.dir) {
    return assetBase + 'outfits/' + outfit.dir + '/' + frameName + '.png';
  }
  return assetBase + 'naiwa-' + frameName + '.png';
}

/**
 * @param {object} options
 * @param {object} options.content             content.js 的导出（ACTIONS/EXPRESSIONS/...）
 * @param {'dom'|'external'} [options.motion]
 * @param {number} [options.size]              宠物宽度（px）
 * @param {number} [options.frameRatio]        画布高宽比
 * @param {{x:number,y:number}} [options.initial]
 * @param {string} [options.outfitId]
 * @param {() => ({width:number,height:number})} [options.bounds]
 * @param {() => number} [options.now]
 * @param {() => number} [options.random]
 * @param {(cb:(t:number)=>void)=>{}} [options.requestFrame]
 * @param {(id:number)=>void} [options.cancelFrame]
 * @param {(view:object)=>void} [options.onPaint]
 * @param {(key:string, ms:number)=>void} [options.onBubble]
 * @param {(kind:string)=>void} [options.onBurst]
 * @param {(type:string, payload:object)=>void} [options.onEvent]
 * @param {(pos:{x:number,y:number})=>void} [options.onPersist]
 * @param {() => [number,number]} [options.getAutoInterval]
 */
function createPet(options = {}) {
  const content = options.content || {};
  const actions = content.ACTIONS || {};
  const expressions = content.EXPRESSIONS || {};
  const actionOrder =
    Array.isArray(content.ACTION_ORDER) && content.ACTION_ORDER.length > 0
      ? content.ACTION_ORDER
      : Object.keys(actions);
  const idleBubbles = options.idleBubbles || content.IDLE_BUBBLES || DEFAULT_IDLE_BUBBLES;
  const clickBubbles = options.clickBubbles || content.CLICK_BUBBLES || DEFAULT_CLICK_BUBBLES;
  const walkBubble = options.walkBubble || content.WALK_BUBBLE || DEFAULT_WALK_BUBBLE;
  const dragBubble = options.dragBubble || content.DRAG_BUBBLE || DEFAULT_DRAG_BUBBLE;
  const dropBubble = options.dropBubble || content.DROP_BUBBLE || DEFAULT_DROP_BUBBLE;
  const greetBubble = options.greetBubble || content.GREET_BUBBLE || DEFAULT_GREET_BUBBLE;

  const nowFn = typeof options.now === 'function' ? options.now : () => Date.now();
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const boundsOf = typeof options.bounds === 'function' ? options.bounds : () => ({ width: 1280, height: 720 });
  const requestFrame = typeof options.requestFrame === 'function' ? options.requestFrame : null;
  const cancelFrame = typeof options.cancelFrame === 'function' ? options.cancelFrame : null;
  const onPaint = typeof options.onPaint === 'function' ? options.onPaint : noop;
  const onBubble = typeof options.onBubble === 'function' ? options.onBubble : noop;
  const onBurst = typeof options.onBurst === 'function' ? options.onBurst : noop;
  const onEvent = typeof options.onEvent === 'function' ? options.onEvent : noop;
  const onPersist = typeof options.onPersist === 'function' ? options.onPersist : noop;
  let getAutoInterval =
    typeof options.getAutoInterval === 'function' ? options.getAutoInterval : () => options.autoInterval;

  const motion = options.motion === 'external' ? 'external' : 'dom';
  const floorGap = finite(options.floorGap, 12);
  const gravity = finite(options.gravity, 2400);
  const walkSpeed = finite(options.walkSpeed, 58);
  const throwFactor = finite(options.throwFactor, 0.45);
  const throwLimit = finite(options.throwLimit, 1600);

  let size = Math.min(360, Math.max(80, finite(options.size, 168)));
  let ratio = Math.min(4, Math.max(0.5, finite(options.frameRatio, DEFAULT_FRAME_RATIO)));
  let outfitId = typeof options.outfitId === 'string' ? options.outfitId : 'classic';
  let frames = options.frames && typeof options.frames === 'object' ? { ...options.frames } : {};
  let running = false;
  let rafId = 0;
  let lastFrame = nowFn();
  let disposed = false;

  const S = {
    x: finite(options.initial && options.initial.x, 64),
    y: finite(options.initial && options.initial.y, 0),
    vx: 0,
    vy: 0,
    mode: 'idle',
    dir: 1,
    targetX: 0,
    dragging: false,
    pointerId: null,
    grabDX: 0,
    grabDY: 0,
    pressAt: 0,
    moved: 0,
    lastPX: 0,
    lastPY: 0,
    lastScreenX: 0,
    lastScreenY: 0,
    lastPT: 0,
    vpx: 0,
    vpy: 0,
    closedUntil: 0,
    maxAir: 0,
    action: '',
    actionUntil: 0,
    actionEffect: '',
    expression: '',
    expressionUntil: 0,
    expressionEffect: '',
    expressionScale: 1,
    spinUntil: 0,
    squashUntil: 0,
  };

  let nextThink = 0;
  let nextBlink = 0;
  let lastClickAt = -1e9;
  let lastPersistAt = 0;
  let timers = [];

  const stageHeight = () => Math.round(size * ratio);
  const maxX = () => Math.max(10, boundsOf().width - size - 8);
  const floorY = () => Math.max(0, boundsOf().height - stageHeight() - floorGap);

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers = timers.filter((timer) => timer !== id);
      if (!disposed) fn();
    }, ms);
    timers.push(id);
    return id;
  };

  const rand = (min, max) => min + random() * (max - min);
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const setMode = (mode) => {
    if (S.mode === mode) return;
    S.mode = mode;
    if (mode !== 'air') S.maxAir = 0;
  };

  const save = (now) => {
    if (now - lastPersistAt < 400) return;
    lastPersistAt = now;
    onPersist({ x: Math.round(S.x), y: Math.round(S.y) });
  };

  const squash = () => {
    S.squashUntil = nowFn() + 260;
    onEvent('squash', {});
    onEvent('animation', { name: 'is-squash', ms: 260 });
  };

  const spin = () => {
    S.spinUntil = nowFn() + 800;
    onEvent('spin', {});
  };

  const say = (key, ms) => {
    if (!key) return;
    onBubble(key, ms == null ? 2400 : ms);
  };

  const idleSay = () => say(pick(idleBubbles), 2600);

  const scheduleThink = (now) => {
    const interval = parseInterval(getAutoInterval(), [2800, 6400]);
    nextThink = now + rand(interval[0], interval[1]);
  };

  const startWalk = () => {
    let goal = rand(12, maxX());
    if (Math.abs(goal - S.x) < 44) goal = S.x > boundsOf().width / 2 ? rand(12, 80) : rand(maxX() - 80, maxX());
    S.targetX = clamp(goal, 8, maxX());
    S.dir = S.targetX > S.x ? -1 : 1;
    setMode('walk');
    if (random() < 0.35) say(walkBubble, 1800);
  };

  const startHop = () => {
    S.maxAir = 0;
    S.vx = rand(-55, 55);
    S.vy = -430;
    setMode('air');
    onEvent('hop', {});
  };

  const playAction = (id) => {
    const action = actions[id];
    if (!action) return false;
    const now = nowFn();
    if (action.duration <= 0) {
      S.action = '';
      S.actionEffect = '';
      S.actionUntil = 0;
      return true;
    }
    S.action = action.id;
    S.actionEffect = action.effect || '';
    S.actionUntil = now + action.duration;
    if (action.hearts) onBurst('hearts');
    if (action.bubble) say(action.bubble, Math.min(2800, action.duration));
    onEvent('action', { id: action.id, effect: S.actionEffect });
    return true;
  };

  const playRandomAction = () => {
    const candidates = actionOrder.filter((id) => actions[id] && actions[id].auto !== false);
    if (candidates.length === 0) return false;
    return playAction(pick(candidates));
  };

  const setExpression = (id) => {
    const expression = expressions[id];
    const now = nowFn();
    if (!expression) {
      S.expression = '';
      S.expressionEffect = '';
      S.expressionUntil = 0;
      S.expressionScale = 1;
      return false;
    }
    S.expression = expression.id;
    S.expressionEffect = expression.effect || '';
    S.expressionUntil = now + (expression.duration || 2400);
    S.expressionScale = finite(expression.scale, 1);
    if (expression.face === 'front-closed') S.closedUntil = Math.max(S.closedUntil, S.expressionUntil);
    if (expression.bubble) say(expression.bubble, 2400);
    onEvent('expression', { id: expression.id, effect: S.expressionEffect });
    return true;
  };

  const think = (now) => {
    if (S.dragging) return;
    if (S.mode !== 'idle') return;
    const roll = random();
    if (motion === 'dom') {
      if (roll < 0.26) startWalk();
      else if (roll < 0.48) startHop();
      else if (roll < 0.6) spin();
      else if (roll < 0.86) playRandomAction();
      else idleSay();
    } else if (roll < 0.42) playRandomAction();
    else if (roll < 0.56) spin();
    else if (roll < 0.7) idleSay();
    scheduleThink(now);
  };

  const react = (now) => {
    S.closedUntil = now + 620;
    playRandomAction();
    onBurst('hearts');
    if (!S.action) say(pick(clickBubbles), 2000);
    squash();
  };

  const walkStep = (dt, now) => {
    const delta = S.targetX - S.x;
    const sign = delta > 0 ? 1 : -1;
    S.dir = sign > 0 ? -1 : 1;
    const step = walkSpeed * dt;
    if (Math.abs(delta) <= step) {
      S.x = S.targetX;
      setMode('idle');
      save(now);
      scheduleThink(now);
    } else {
      S.x += sign * step;
    }
  };

  const airStep = (dt, now) => {
    S.vy += gravity * dt;
    S.x += S.vx * dt;
    S.y += S.vy * dt;

    const air = floorY() - S.y;
    if (air > S.maxAir) S.maxAir = air;

    const minX = 6;
    const mx = maxX();
    if (S.x < minX) {
      S.x = minX;
      S.vx = Math.abs(S.vx) * 0.55;
      squash();
    } else if (S.x > mx) {
      S.x = mx;
      S.vx = -Math.abs(S.vx) * 0.55;
      squash();
    }
    if (S.y < -stageHeight() * 0.4) {
      S.y = -stageHeight() * 0.4;
      S.vy = Math.abs(S.vy) * 0.45;
    }

    const floor = floorY();
    if (S.y >= floor) {
      S.y = floor;
      if (S.vy > 520) {
        S.vy = -S.vy * 0.34;
        S.vx *= 0.72;
        squash();
        if (S.maxAir > 90) {
          onBurst('dust');
          S.maxAir = 0;
        }
      } else {
        const dropped = S.maxAir > 140;
        S.vy = 0;
        S.vx = 0;
        S.maxAir = 0;
        setMode('idle');
        squash();
        if (dropped) {
          onBurst('dust');
          if (random() < 0.55) say(dropBubble, 1500);
        }
        save(now);
        scheduleThink(now);
      }
    }
  };

  const reconcileStates = (now) => {
    if (S.action && now >= S.actionUntil) {
      S.action = '';
      S.actionEffect = '';
    }
    if (S.expression && now >= S.expressionUntil) {
      S.expression = '';
      S.expressionEffect = '';
      S.expressionScale = 1;
    }
  };

  const faceFor = (now) => {
    if (S.mode === 'walk') return 'side';
    if (now < S.closedUntil) return 'closed';
    return 'front';
  };

  const view = (now) => ({
    size,
    stageH: stageHeight(),
    x: Math.round(S.x * 100) / 100,
    y: Math.round(S.y * 100) / 100,
    mode: S.mode,
    dir: S.dir,
    dragging: S.dragging,
    tilt: S.dragging ? clamp(S.vpx / 55, -13, 13) : 0,
    face: faceFor(now),
    closed: now < S.closedUntil,
    action: S.action,
    actionEffect: S.actionEffect,
    expression: S.expression,
    expressionEffect: S.expressionEffect,
    expressionScale: S.expressionScale,
    spin: now < S.spinUntil,
    squash: now < S.squashUntil,
    outfitId,
    frames,
    floorY: floorY(),
  });

  const paint = (now) => {
    onPaint(view(now));
  };

  const tick = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!Number.isFinite(dt) || dt <= 0) {
      paint(now);
      return;
    }

    if (motion === 'dom' && !S.dragging) {
      if (S.mode === 'walk') walkStep(dt, now);
      else if (S.mode === 'air') airStep(dt, now);
    }

    reconcileStates(now);

    if (!S.dragging && S.mode === 'idle') {
      if (now > nextThink) think(now);
      if (now > nextBlink && now > S.closedUntil) {
        S.closedUntil = now + 130;
        nextBlink = now + rand(2800, 6800);
        if (random() < 0.3)
          later(() => {
            if (!disposed) S.closedUntil = Math.max(S.closedUntil, nowFn() + 120);
          }, 280);
      }
    }

    paint(now);
  };

  const frame = (now) => {
    if (!running || disposed) return;
    rafId = requestFrame ? requestFrame(frame) : 0;
    tick(typeof now === 'number' ? now : nowFn());
  };

  const start = () => {
    if (running || disposed) return;
    running = true;
    lastFrame = nowFn();
    nextThink = lastFrame + 1200;
    nextBlink = lastFrame + rand(1400, 3200);
    S.y = clamp(S.y, -40, floorY());
    S.x = clamp(S.x, 8, maxX());
    if (motion === 'dom') {
      if (Math.abs(S.y - floorY()) > 2) {
        // 刷新后保存的位置可能悬在半空：直接进入下落状态，落回地面。
        S.mode = 'air';
        S.vx = 0;
        S.vy = 0;
      } else {
        S.y = floorY();
      }
    }
    paint(lastFrame);
    if (requestFrame) rafId = requestFrame(frame);
    later(() => say(greetBubble, 2600), 500);
  };

  const stop = () => {
    running = false;
    if (rafId && cancelFrame) cancelFrame(rafId);
    rafId = 0;
    for (const timer of timers) clearTimeout(timer);
    timers = [];
    disposed = true;
  };

  const setSize = (next) => {
    const clamped = Math.min(360, Math.max(80, finite(next, size)));
    if (clamped === size) return;
    size = clamped;
    const floor = floorY();
    if (S.mode !== 'air' && !S.dragging) S.y = floor;
    S.x = clamp(S.x, 8, maxX());
    if (running) paint(nowFn());
  };

  const setOutfit = (id) => {
    if (typeof id !== 'string' || id.length === 0) return;
    outfitId = id;
    if (running) paint(nowFn());
  };

  const setFrames = (map) => {
    frames = map && typeof map === 'object' ? { ...map } : {};
    if (running) paint(nowFn());
  };

  const setFrameRatio = (next) => {
    ratio = Math.min(4, Math.max(0.5, finite(next, ratio)));
    if (S.mode !== 'air' && !S.dragging) S.y = floorY();
    if (running) paint(nowFn());
  };

  const resize = () => {
    const floor = floorY();
    if (S.mode === 'idle' || S.mode === 'action') S.y = floor;
    else S.y = Math.min(S.y, floor);
    S.x = clamp(S.x, 8, maxX());
    if (running) paint(nowFn());
  };

  // ---------- 指针手势（适配层把原生事件折算成统一坐标）----------
  const pointerDown = (point) => {
    if (S.dragging) return;
    const now = point && point.time != null ? point.time : nowFn();
    S.dragging = true;
    S.pointerId = point && point.pointerId != null ? point.pointerId : 1;
    S.pressAt = now;
    S.moved = 0;
    S.lastPX = point.x;
    S.lastPY = point.y;
    S.lastScreenX = point.screenX != null ? point.screenX : point.x;
    S.lastScreenY = point.screenY != null ? point.screenY : point.y;
    S.lastPT = now;
    S.vpx = 0;
    S.vpy = 0;
    S.grabDX = point.x - S.x;
    S.grabDY = point.y - S.y;
    setMode('drag');
    onEvent('dragstart', {});
    if (running) paint(now);
  };

  const pointerMove = (point) => {
    if (!S.dragging) return;
    if (point.pointerId != null && S.pointerId != null && point.pointerId !== S.pointerId) return;
    const now = point.time != null ? point.time : nowFn();
    const dt = Math.max(12, now - S.lastPT) / 1000;
    const screenX = point.screenX != null ? point.screenX : point.x;
    const screenY = point.screenY != null ? point.screenY : point.y;
    const dx = screenX - S.lastScreenX;
    const dy = screenY - S.lastScreenY;
    S.moved += Math.hypot(dx, dy);
    S.vpx = S.vpx * 0.55 + (dx / dt) * 0.45;
    S.vpy = S.vpy * 0.55 + (dy / dt) * 0.45;
    S.lastPX = point.x;
    S.lastPY = point.y;
    S.lastScreenX = screenX;
    S.lastScreenY = screenY;
    S.lastPT = now;

    if (motion === 'dom') {
      S.x = clamp(point.x - S.grabDX, -34, boundsOf().width - size + 34);
      S.y = clamp(point.y - S.grabDY, -34, floorY());
    } else {
      onEvent('dragdelta', { dx, dy });
    }
    if (running) paint(now);
  };

  const endDrag = (point, cancelled) => {
    if (!S.dragging) return;
    if (point && point.pointerId != null && S.pointerId != null && point.pointerId !== S.pointerId) return;
    const now = point && point.time != null ? point.time : nowFn();
    S.dragging = false;
    S.pointerId = null;
    const held = now - S.pressAt;

    if (!cancelled && S.moved < 8 && held < 460) {
      const isDouble = now - lastClickAt < 330;
      lastClickAt = now;
      setMode(motion === 'dom' ? 'idle' : S.mode === 'drag' ? 'idle' : S.mode);
      if (isDouble) {
        S.closedUntil = now + 520;
        spin();
        if (running) paint(now);
        return;
      }
      react(now);
      if (running) paint(now);
      return;
    }

    if (cancelled) {
      S.vx = 0;
      S.vy = 0;
      setMode(motion === 'dom' ? 'idle' : 'idle');
      onEvent('dragend', { vx: 0, vy: 0 });
      if (running) paint(now);
      return;
    }

    const vx = clamp(S.vpx * throwFactor, -throwLimit, throwLimit);
    const vy = clamp(S.vpy * throwFactor, -throwLimit, 700);
    onEvent('dragend', { vx, vy });
    if (motion === 'dom') {
      S.vx = vx;
      S.vy = vy;
      S.maxAir = Math.max(0, floorY() - S.y);
      setMode('air');
    } else {
      S.vx = 0;
      S.vy = 0;
      setMode('idle');
    }
    if (S.moved > 70 && random() < 0.4) say(dragBubble, 1200);
    if (running) paint(now);
  };

  const pointerUp = (point) => endDrag(point, false);
  const pointerCancel = (point) => endDrag(point, true);

  /** 桌面形态：主进程报告窗口运动状态。 */
  const externalMotion = (state) => {
    if (motion !== 'external' || !state) return;
    if (state.mode === 'air') {
      setMode('air');
    } else if (state.mode === 'walk') {
      S.dir = state.dir === 1 || state.dir === -1 ? state.dir : S.dir;
      setMode('walk');
    } else {
      setMode('idle');
    }
    if (state.squash) squash();
    if (running) paint(nowFn());
  };

  return {
    version: CORE_VERSION,
    start,
    stop,
    tick,
    paint: () => paint(nowFn()),
    view: () => view(nowFn()),
    resize,
    setSize,
    setOutfit,
    setFrames,
    setFrameRatio,
    setExpression,
    setIntervalSource: (source) => {
      getAutoInterval = typeof source === 'function' ? source : () => undefined;
    },
    playAction,
    playRandomAction,
    say,
    squash,
    spin,
    externalMotion,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    state: () => ({ ...S }),
    bounds: () => ({ maxX: maxX(), floorY: floorY(), stageH: stageHeight(), size }),
  };
}
/* global createPet, PET_CSS, BUBBLE_TEXT, ACTIONS, EXPRESSIONS, ACTION_ORDER, DEFAULT_FRAME_RATIO, labelOf */
/* global IDLE_BUBBLES, CLICK_BUBBLES, WALK_BUBBLE, DRAG_BUBBLE, DROP_BUBBLE, GREET_BUBBLE */
/* global window, document, navigator, performance, requestAnimationFrame, cancelAnimationFrame, setTimeout, clearTimeout, console */

/**
 * 桌面形态渲染页 —— 源码片段（构建时与 content.js / pet-core.js 一起内联成 desktop/pet-app.js）。
 *
 * 这里只做三件事：把 core 的表现描述画成 DOM、把手势转给 Electron 主进程移动窗口、
 * 把主进程推来的窗口运动状态回灌给 core。没有第二套宠物状态机。
 */
const bridge = window.petBridge;
const layoutRatio = DEFAULT_FRAME_RATIO;

const naiwaLang = (navigator.language || 'zh').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
const root = document.getElementById('pet-root');

function makeElement(tag, className, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (parent) parent.appendChild(node);
  return node;
}

const styleNode = makeElement('style', '', root);
styleNode.textContent = PET_CSS;
const layer = makeElement('div', 'naiwa-layer', root);
layer.style.cssText = 'position:fixed;inset:0';
const shadow = makeElement('div', 'naiwa-shadow', layer);
const stage = makeElement('div', 'naiwa-stage', layer);
stage.style.cssText = 'left:0;bottom:0;top:auto';
const flip = makeElement('div', 'naiwa-flip', stage);
const tilt = makeElement('div', 'naiwa-tilt', flip);
const body = makeElement('div', 'naiwa-body', tilt);
body.dataset.mode = 'idle';
body.dataset.face = 'front';
const frontImg = makeElement('img', 'naiwa-img naiwa-front', body);
const sideImg = makeElement('img', 'naiwa-img naiwa-side', body);
const closedImg = makeElement('img', 'naiwa-img naiwa-closed', body);
frontImg.alt = '';
sideImg.alt = '';
closedImg.alt = '';
frontImg.draggable = false;
sideImg.draggable = false;
closedImg.draggable = false;
makeElement('div', 'naiwa-blush', body);
const bubble = makeElement('div', 'naiwa-bubble', stage);
const fx = makeElement('div', 'naiwa-fx', stage);
const hit = makeElement('div', 'naiwa-hit', stage);

let pet = null;
let bubbleTimer = 0;
let lastState = null;

function speak(key, ms) {
  const text = labelOf(BUBBLE_TEXT[key], naiwaLang);
  if (!text) return;
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms == null ? 2400 : ms);
}

function flash(name, ms) {
  body.classList.remove(name);
  void body.offsetWidth;
  body.classList.add(name);
  setTimeout(() => body.classList.remove(name), ms);
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function burst(kind) {
  const fragment = document.createDocumentFragment();
  const count = kind === 'hearts' ? 6 : 5;
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('span');
    if (kind === 'hearts') {
      const glyphs = ['💛', '🧡', '💛', '✨'];
      particle.className = 'naiwa-heart';
      particle.textContent = glyphs[index % glyphs.length];
      particle.style.left = (48 + rand(-18, 18)).toFixed(1) + '%';
      particle.style.top = (24 + rand(-6, 6)).toFixed(1) + '%';
      particle.style.fontSize = Math.round(rand(13, 19)) + 'px';
      particle.style.setProperty('--dx', rand(-48, 48).toFixed(0) + 'px');
      particle.style.animationDelay = Math.round(rand(0, 170)) + 'ms';
    } else {
      particle.className = 'naiwa-dust';
      particle.style.left = (50 + rand(-16, 16)).toFixed(1) + '%';
      particle.style.fontSize = Math.round(rand(7, 13)) + 'px';
      particle.style.setProperty('--dx', rand(-26, 26).toFixed(0) + 'px');
      particle.style.animationDelay = Math.round(rand(0, 60)) + 'ms';
    }
    fragment.appendChild(particle);
  }
  fx.appendChild(fragment);
  setTimeout(() => {
    while (fx.firstChild) fx.removeChild(fx.firstChild);
  }, 1400);
}

function paint(view) {
  stage.style.width = view.size + 'px';
  stage.style.height = view.stageH + 'px';
  flip.style.transform = view.dir === 1 ? 'scaleX(1)' : 'scaleX(-1)';
  tilt.style.transform = view.tilt ? 'rotate(' + view.tilt.toFixed(2) + 'deg) scale(1.03)' : '';
  body.dataset.face = view.face;
  body.dataset.mode = view.mode;
  body.dataset.action = view.actionEffect || '';
  body.dataset.expression = view.expressionEffect || '';
  body.style.transform =
    view.expressionScale && view.expressionScale !== 1 ? 'scale(' + view.expressionScale + ')' : '';

  shadow.style.transform = 'translate3d(' + (view.size / 2 - 56).toFixed(1) + 'px, 0px, 0) scale(1,1)';
  shadow.style.left = '0px';
  shadow.style.bottom = '0px';
  shadow.style.top = 'auto';

  frontImg.src = view.frames.front || frontImg.src;
  sideImg.src = view.frames.side || sideImg.src;
  closedImg.src = view.frames['front-closed'] || closedImg.src;
  stage.style.opacity = '1';
}

function pointOf(event) {
  return {
    x: event.clientX,
    y: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
    pointerId: event.pointerId,
    time: performance.now(),
  };
}

hit.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  try {
    hit.setPointerCapture(event.pointerId);
  } catch {
    /* 捕获失败时退化为普通 pointer 事件 */
  }
  if (pet) pet.pointerDown(pointOf(event));
});
hit.addEventListener('pointermove', (event) => {
  if (pet) pet.pointerMove(pointOf(event));
});
hit.addEventListener('pointerup', (event) => {
  if (pet) pet.pointerUp(pointOf(event));
});
hit.addEventListener('pointercancel', (event) => {
  if (pet) pet.pointerCancel(pointOf(event));
});
hit.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  if (pet) pet.pointerCancel({});
  bridge.showMenu();
});

function applyState(state) {
  if (!state || !state.config || !pet) return;
  lastState = state;
  pet.setSize(state.config.petSize);
  pet.setOutfit(state.config.activeOutfit);
  pet.setFrames(state.frames || {});
  const interval = state.config.autoActionInterval;
  pet.setIntervalSource(() => interval);
  pet.paint();
}

function create() {
  pet = createPet({
    content: {
      ACTIONS,
      EXPRESSIONS,
      ACTION_ORDER,
      IDLE_BUBBLES,
      CLICK_BUBBLES,
      WALK_BUBBLE,
      DRAG_BUBBLE,
      DROP_BUBBLE,
      GREET_BUBBLE,
    },
    motion: 'external',
    size: lastState && lastState.config ? lastState.config.petSize : 168,
    frameRatio: layoutRatio,
    outfitId: lastState && lastState.config ? lastState.config.activeOutfit : 'classic',
    frames: lastState ? lastState.frames : {},
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
    bounds: () => ({ width: window.innerWidth, height: window.innerHeight }),
    now: () => performance.now(),
    onPaint: paint,
    onBubble: speak,
    onBurst: burst,
    onPersist: () => {},
    onEvent: (type, detail) => {
      if (type === 'squash') flash('is-squash', 300);
      else if (type === 'spin') flash('is-spin', 850);
      else if (type === 'hop') flash('is-hop', 440);
      else if (type === 'dragdelta') bridge.moveBy(detail.dx, detail.dy);
      else if (type === 'dragend') {
        if (Math.abs(detail.vx) > 12 || Math.abs(detail.vy) > 12) bridge.throwWindow(detail.vx, detail.vy);
      }
    },
  });
  pet.start();

  bridge.onState(applyState);
  bridge.onMotion((motion) => {
    if (pet) pet.externalMotion(motion);
  });
  bridge.onAction((id) => {
    if (pet) pet.playAction(id);
  });
  bridge.onExpression((id) => {
    if (pet) pet.setExpression(id);
  });
  bridge.onSpeak((key) => speak(key, 2200));

  window.addEventListener('resize', () => {
    if (pet) pet.paint();
  });

  bridge
    .getState()
    .then((state) => {
      applyState(state);
      document.documentElement.style.background = 'transparent';
    })
    .catch((error) => console.error('[naiwa-pet] desktop state failed: ' + String(error)));
}

create();
})();
