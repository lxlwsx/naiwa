/**
 * DSH 浏览器半侧 —— 源码模板。
 *
 * 这个文件不是运行产物：scripts/build-client.mjs 会把下面两个占位注释替换成
 * content.js / pet-core.js（去掉 ESM export 后的函数体），再写到 naiwa-pet/client.js。
 * 直接改 client.js 会在下次 build 时被覆盖，也会被 tests/client-contract 判红。
 *
 * 契约（v0.2 起不变）：
 *   - 仍然通过 window.__ModuleLoader__.load({ id: 'dsh-naiwa-pet', factory })
 *   - 仍然向 shell.overlay 注册唯一一个 id 为 'naiwa-pet' 的占位
 *   - 素材仍然走宿主 /dsh-naiwa-pet-7341/assets/ 前缀路由
 */
window.__ModuleLoader__.load({
  id: 'dsh-naiwa-pet',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useRef, useState } = React;

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

    const NS = 'naiwa.pet';
    const ROUTE = '/dsh-naiwa-pet-7341';
    const ASSET_BASE = ROUTE + '/assets/';
    const POS_KEY = 'dsh-naiwa-pet:pos:v1';
    const SETTINGS_ORDER = 40;

    const ZH = {
      lang: 'zh',
      greet: '奶娃来啦～',
      'bubble.greet': '奶娃来啦～',
      'bubble.idle.1': '摸鱼中…',
      'bubble.idle.2': '今天也要加油鸭',
      'bubble.idle.3': '抱抱我嘛',
      'bubble.idle.4': '肚子有点饿了',
      'bubble.idle.5': '我就在这儿陪你',
      'bubble.click.1': '呀！被摸头了～',
      'bubble.click.2': '嘿嘿，好痒',
      'bubble.click.3': '再摸一下嘛',
      'bubble.walk': '我出去溜达一圈',
      'bubble.drag': '放我下来啦～',
      'bubble.drop': '哎哟喂～',
      'bubble.action.eat': '好好吃～',
      'bubble.action.small-move': '伸个懒腰～',
      'bubble.action.drink': '咕嘟咕嘟',
      'bubble.action.sweet-talk': '最喜欢你啦',
      'bubble.expression.tsundere': '哼，才不是呢',
      'bubble.expression.shy': '别、别看我啦',
      'bubble.expression.enjoy': '好舒服呀',
      'bubble.expression.blush': '脸好烫…',
      'bubble.expression.cute': '快夸我！',
      'menu.actions': '动作',
      'menu.outfits': '服饰',
      'menu.expressions': '表情',
      'menu.apps': '打开应用',
      'menu.position': '显示位置',
      'menu.settings': '桌宠设置',
      'menu.quit': '退出',
      'menu.action.eat': '吃什么',
      'menu.action.idle': '待机',
      'menu.action.small-move': '小动作',
      'menu.action.drink': '喝什么',
      'menu.action.sweet-talk': '小情话',
      'menu.expression.tsundere': '傲娇',
      'menu.expression.shy': '害羞',
      'menu.expression.enjoy': '享受',
      'menu.expression.blush': '脸红',
      'menu.expression.cute': '卖萌',
      'menu.position.app': '仅应用内',
      'menu.position.desktop': '仅桌面',
      'menu.position.both': '两者都显示',
      'menu.position.none': '都不显示',
      'menu.app.deepseek-web': 'DeepSeek 网页端',
      'menu.app.dsh-local': 'DeepSeek Harness',
      'menu.submenu': '▸',
      'panel.title': '桌宠设置',
      'panel.size': '桌宠大小（px）',
      'panel.mode': '显示位置',
      'panel.outfit': '当前服饰',
      'panel.interval': '自动动作间隔（毫秒，如 2800-6400）',
      'panel.apps': '自定义应用（JSON，改配置文件或在这里编辑）',
      'panel.configPath': '配置文件',
      'panel.desktop': '桌面形态',
      'panel.desktopRunning': '运行中',
      'panel.desktopStopped': '未启动',
      'panel.desktopMissing': '未找到 Electron',
      'panel.save': '保存',
      'panel.saved': '已保存',
      'panel.close': '关闭',
      'panel.reset': '恢复默认',
      'panel.invalidApps': '自定义应用 JSON 不合法，未保存',
      'panel.saveFailed': '保存失败，请检查 DSH 宿主日志',
      'panel.launchFailed': '打开应用失败',
      'settings.title': '桌宠',
      'settings.lead': '奶娃可以待在 DSH 页面里，也可以放进桌面透明小窗。',
      'settings.outfitMissing': '素材未提供时会自动回退到原色帧（不影响使用）。',
      'settings.openDesktop': '启动桌面形态',
      'settings.closeDesktop': '关闭桌面形态',
    };
    const EN = {
      lang: 'en',
      greet: 'Naiwa is here!',
      'bubble.greet': 'Naiwa is here!',
      'bubble.idle.1': 'Slacking off…',
      'bubble.idle.2': 'You can do it today!',
      'bubble.idle.3': 'Hug me?',
      'bubble.idle.4': 'A little hungry…',
      'bubble.idle.5': 'I am right here with you',
      'bubble.click.1': 'Ah! Head pats!',
      'bubble.click.2': 'Hehe, that tickles',
      'bubble.click.3': 'One more pat?',
      'bubble.walk': 'Off for a little walk',
      'bubble.drag': 'Put me down~',
      'bubble.drop': 'Oof!',
      'bubble.action.eat': 'Yummy~',
      'bubble.action.small-move': 'Big stretch~',
      'bubble.action.drink': 'Glug glug',
      'bubble.action.sweet-talk': 'I like you the most',
      'bubble.expression.tsundere': 'Hmph, no I am not',
      'bubble.expression.shy': 'D-don’t look at me',
      'bubble.expression.enjoy': 'So comfy',
      'bubble.expression.blush': 'My face is hot…',
      'bubble.expression.cute': 'Praise me!',
      'menu.actions': 'Actions',
      'menu.outfits': 'Outfits',
      'menu.expressions': 'Expressions',
      'menu.apps': 'Open app',
      'menu.position': 'Display',
      'menu.settings': 'Pet settings',
      'menu.quit': 'Quit',
      'menu.action.eat': 'Eat',
      'menu.action.idle': 'Idle',
      'menu.action.small-move': 'Little move',
      'menu.action.drink': 'Drink',
      'menu.action.sweet-talk': 'Sweet talk',
      'menu.expression.tsundere': 'Tsundere',
      'menu.expression.shy': 'Shy',
      'menu.expression.enjoy': 'Enjoy',
      'menu.expression.blush': 'Blush',
      'menu.expression.cute': 'Cute',
      'menu.position.app': 'In app only',
      'menu.position.desktop': 'Desktop only',
      'menu.position.both': 'Both',
      'menu.position.none': 'Hidden',
      'menu.app.deepseek-web': 'DeepSeek Web',
      'menu.app.dsh-local': 'DeepSeek Harness',
      'menu.submenu': '▸',
      'panel.title': 'Pet settings',
      'panel.size': 'Pet size (px)',
      'panel.mode': 'Display',
      'panel.outfit': 'Outfit',
      'panel.interval': 'Auto action interval (ms, e.g. 2800-6400)',
      'panel.apps': 'Custom apps (JSON)',
      'panel.configPath': 'Config file',
      'panel.desktop': 'Desktop mode',
      'panel.desktopRunning': 'running',
      'panel.desktopStopped': 'stopped',
      'panel.desktopMissing': 'Electron not found',
      'panel.save': 'Save',
      'panel.saved': 'Saved',
      'panel.close': 'Close',
      'panel.reset': 'Reset',
      'panel.invalidApps': 'Custom apps JSON is invalid; nothing saved',
      'panel.saveFailed': 'Save failed; check the host log',
      'panel.launchFailed': 'Could not open the app',
      'settings.title': 'Pet',
      'settings.lead': 'Naiwa can live inside the DSH page or float in a desktop window.',
      'settings.outfitMissing': 'Missing outfit frames fall back to the base art; nothing breaks.',
      'settings.openDesktop': 'Start desktop window',
      'settings.closeDesktop': 'Stop desktop window',
    };

    for (const [key, text] of Object.entries(BUBBLE_TEXT)) {
      ZH[key] = text.zh;
      EN[key] = text.en;
    }

    const BASE_FRAMES = {
      front: ASSET_BASE + 'naiwa-front.png',
      'front-closed': ASSET_BASE + 'naiwa-front-closed.png',
      side: ASSET_BASE + 'naiwa-side.png',
    };

    const MENU_CSS = `
.naiwa-menu{position:fixed;z-index:2147483002;min-width:168px;max-height:70vh;overflow:visible;padding:6px;border-radius:12px;background:rgba(255,252,246,.985);color:#3d2f16;box-shadow:0 14px 38px rgba(40,28,6,.28);font:500 13px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto}
.naiwa-menu-item{position:relative}
.naiwa-menu-button{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.naiwa-menu-button:hover,.naiwa-menu-button:focus-visible{background:rgba(243,196,84,.28);outline:none}
.naiwa-menu-arrow{opacity:.5;font-size:10px}
.naiwa-submenu{display:none;position:absolute;left:100%;top:-6px;min-width:160px;padding:6px;border-radius:12px;background:rgba(255,252,246,.99);box-shadow:0 14px 38px rgba(40,28,6,.24);pointer-events:auto}
.naiwa-menu-item:hover>.naiwa-submenu,.naiwa-menu-item:focus-within>.naiwa-submenu{display:block}
.naiwa-menu-sep{height:1px;margin:5px 8px;background:rgba(80,60,20,.14)}
.naiwa-panel{position:fixed;z-index:2147483003;width:min(340px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow:auto;padding:14px;border-radius:14px;background:rgba(255,252,246,.99);color:#3d2f16;box-shadow:0 18px 48px rgba(40,28,6,.3);font:500 13px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:auto}
.naiwa-panel h3{margin:0 0 10px;font-size:15px}
.naiwa-field{display:grid;gap:4px;margin-bottom:10px}
.naiwa-field>span{font-size:12px;opacity:.78}
.naiwa-field input[type="number"],.naiwa-field input[type="text"],.naiwa-field textarea,.naiwa-field select{width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid rgba(90,70,30,.24);border-radius:8px;background:#fffdf7;color:inherit;font:inherit}
.naiwa-field textarea{min-height:88px;resize:vertical;font-family:ui-monospace,Consolas,monospace;font-size:12px}
.naiwa-row{display:flex;flex-wrap:wrap;gap:6px}
.naiwa-chip{padding:5px 10px;border:1px solid rgba(90,70,30,.22);border-radius:999px;background:#fffdf7;color:inherit;font:inherit;cursor:pointer}
.naiwa-chip.is-active{border-color:rgba(210,150,30,.9);background:rgba(243,196,84,.34)}
.naiwa-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.naiwa-actions button{padding:6px 14px;border:0;border-radius:9px;background:rgba(243,196,84,.9);color:#3d2f16;font:inherit;cursor:pointer}
.naiwa-hint{font-size:11.5px;opacity:.66;word-break:break-all}
.naiwa-settings-page{display:grid;gap:14px;max-width:620px;color:inherit;font:inherit}
.naiwa-settings-page h3{margin:0;font-size:15px}
.naiwa-settings-page p{margin:0;opacity:.75;font-size:12.5px}
.naiwa-settings-card{display:grid;gap:10px;padding:14px;border:1px solid rgba(120,100,60,.18);border-radius:12px}
`;

    const rand = (min, max) => min + Math.random() * (max - min);

    function labelText(label, lang) {
      if (!label) return '';
      if (typeof label === 'string') return label;
      return label[lang] ?? label.zh ?? label.en ?? '';
    }

    function loadSavedPosition() {
      try {
        const raw = window.localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) return { x: parsed.x, y: parsed.y };
      } catch {
        /* 隐私模式下读不到就算了 */
      }
      return null;
    }

    function persistPosition(position) {
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(position));
      } catch {
        /* 存不了就算了 */
      }
    }

    async function apiFetch(path, options) {
      const response = await fetch(ROUTE + path, options);
      if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + path);
      return response.json();
    }

    function loadConfig() {
      return apiFetch('/config', { cache: 'no-store' });
    }

    function saveConfig(patch) {
      return apiFetch('/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naiwa-Pet': '1' },
        body: JSON.stringify(patch),
      });
    }

    function launchApp(id) {
      return apiFetch('/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naiwa-Pet': '1' },
        body: JSON.stringify({ id }),
      });
    }

    function pingHost(part) {
      return fetch(ROUTE + '/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Naiwa-Pet': '1' },
        body: JSON.stringify({ part }),
      }).catch(() => {});
    }

    function loadOutfitIndex() {
      return apiFetch('/assets/outfits/index.json', { cache: 'no-cache' });
    }

    function probeImage(url) {
      return new Promise((resolve) => {
        const image = new Image();
        let settled = false;
        const finish = (ok) => {
          if (settled) return;
          settled = true;
          resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 1500);
        image.onload = () => {
          clearTimeout(timer);
          finish(image.naturalWidth > 0 && image.naturalHeight > 0);
        };
        image.onerror = () => {
          clearTimeout(timer);
          finish(false);
        };
        image.src = url;
      });
    }

    const frameCache = new Map();

    async function resolveOutfitFrames(outfit) {
      if (!outfit || !outfit.dir) return { ...BASE_FRAMES, ratioSource: BASE_FRAMES.front };
      const key = outfit.dir;
      if (frameCache.has(key)) return frameCache.get(key);
      const pending = (async () => {
        const frames = { ...BASE_FRAMES };
        let metaFrames = null;
        try {
          const meta = await apiFetch('/assets/outfits/' + outfit.dir + '/meta.json', { cache: 'no-cache' });
          if (Array.isArray(meta?.frames) && meta.frames.length > 0) metaFrames = new Set(meta.frames);
        } catch {
          metaFrames = null;
        }
        for (const name of FRAME_NAMES) {
          if (metaFrames && !metaFrames.has(name)) continue;
          const url = ASSET_BASE + 'outfits/' + outfit.dir + '/' + name + '.png';
          if (await probeImage(url)) frames[name] = url;
        }
        return { ...frames };
      })();
      frameCache.set(key, pending);
      return pending;
    }

    function useHostConfig() {
      const [snapshot, setSnapshot] = useState(null);
      const [error, setError] = useState('');
      const apply = useCallback((next) => {
        if (next && next.config) setSnapshot(next);
      }, []);
      useEffect(() => {
        let alive = true;
        let timer = 0;
        const refresh = () => {
          loadConfig()
            .then((next) => {
              if (!alive) return;
              setSnapshot(next);
              setError('');
            })
            .catch((err) => {
              if (alive) setError(String(err && err.message ? err.message : err));
            })
            .finally(() => {
              if (alive) timer = setTimeout(refresh, 2500);
            });
        };
        refresh();
        return () => {
          alive = false;
          clearTimeout(timer);
        };
      }, []);
      const save = useCallback(
        async (patch) => {
          const next = await saveConfig(patch);
          apply(next);
          return next;
        },
        [apply],
      );
      return { snapshot, save, error };
    }

    function BurstLayer(props) {
      const { bursts } = props;
      return h(
        'div',
        { className: 'naiwa-fx' },
        bursts.map((item) =>
          h(
            'div',
            { key: item.id, className: 'naiwa-fx' },
            item.parts.map((part, index) =>
              h(
                'span',
                {
                  key: index,
                  className: item.kind === 'hearts' ? 'naiwa-heart' : 'naiwa-dust',
                  style: {
                    left: part.left,
                    top: item.kind === 'hearts' ? part.top : undefined,
                    fontSize: part.size + 'px',
                    '--dx': part.dx,
                    animationDelay: part.delay + 'ms',
                  },
                },
                part.glyph,
              ),
            ),
          ),
        ),
      );
    }

    function SettingsForm(props) {
      const { t, snapshot, save, page } = props;
      const config = snapshot?.config ?? null;
      const outfits = props.outfits ?? [];
      const [draft, setDraft] = useState(null);
      const [status, setStatus] = useState('');
      const [appsText, setAppsText] = useState('');
      const [appsDirty, setAppsDirty] = useState(false);
      const [sizeDraft, setSizeDraft] = useState(config?.petSize ?? 168);
      const [customAppsError, setCustomAppsError] = useState('');

      useEffect(() => {
        if (!config) return;
        if (!draft) setDraft({ ...config });
        setSizeDraft(config.petSize);
      }, [config, draft]);

      useEffect(() => {
        if (config && !appsDirty) setAppsText(JSON.stringify(config.customApps ?? [], null, 2));
      }, [config, appsDirty]);

      if (!config || !draft) return null;

      const commit = async (patch) => {
        try {
          const next = await save(patch);
          setDraft({ ...next.config });
          setStatus(t('panel.saved'));
          setTimeout(() => setStatus(''), 1600);
        } catch (err) {
          console.warn('[dsh-naiwa-pet] save failed: ' + String(err));
          setStatus(t('panel.saveFailed'));
        }
      };

      const update = (key, value) => {
        setDraft((prev) => ({ ...prev, [key]: value }));
        setStatus('');
      };

      const applyApps = () => {
        let parsed;
        try {
          parsed = JSON.parse(appsText || '[]');
        } catch {
          setCustomAppsError(t('panel.invalidApps'));
          return;
        }
        if (!Array.isArray(parsed)) {
          setCustomAppsError(t('panel.invalidApps'));
          return;
        }
        setCustomAppsError('');
        setAppsDirty(false);
        commit({ customApps: parsed });
      };

      const chooseOutfit = (id) => {
        update('activeOutfit', id);
        commit({ activeOutfit: id });
      };

      const body = [
        h(
          'div',
          { key: 'size', className: 'naiwa-field' },
          h('span', null, t('panel.size')),
          h('input', {
            type: 'range',
            min: 80,
            max: 360,
            step: 4,
            value: sizeDraft,
            onChange: (event) => {
              const value = Number(event.target.value);
              setSizeDraft(value);
              update('petSize', value);
            },
            onPointerUp: () => commit({ petSize: sizeDraft }),
            onKeyUp: () => commit({ petSize: sizeDraft }),
          }),
          h('span', { className: 'naiwa-hint' }, String(sizeDraft) + ' px'),
        ),
        h(
          'div',
          { key: 'mode', className: 'naiwa-field' },
          h('span', null, t('panel.mode')),
          h(
            'div',
            { className: 'naiwa-row' },
            POSITION_MODES.map((mode) =>
              h(
                'button',
                {
                  key: mode.id,
                  type: 'button',
                  className: 'naiwa-chip' + (draft.displayMode === mode.id ? ' is-active' : ''),
                  onClick: () => {
                    update('displayMode', mode.id);
                    commit({ displayMode: mode.id });
                  },
                },
                t('menu.position.' + mode.id),
              ),
            ),
          ),
        ),
        h(
          'div',
          { key: 'outfit', className: 'naiwa-field' },
          h('span', null, t('panel.outfit')),
          h(
            'select',
            { value: draft.activeOutfit, onChange: (event) => chooseOutfit(event.target.value) },
            outfits.map((outfit) =>
              h('option', { key: outfit.id, value: outfit.id }, labelText(outfit.name, t('lang'))),
            ),
          ),
          h('span', { className: 'naiwa-hint' }, t('settings.outfitMissing')),
        ),
        h(
          'div',
          { key: 'interval', className: 'naiwa-field' },
          h('span', null, t('panel.interval')),
          h('input', {
            type: 'text',
            value: String(draft.autoActionInterval ?? ''),
            onChange: (event) => update('autoActionInterval', event.target.value),
            onBlur: () => commit({ autoActionInterval: draft.autoActionInterval }),
          }),
        ),
        h(
          'div',
          { key: 'apps', className: 'naiwa-field' },
          h('span', null, t('panel.apps')),
          h('textarea', {
            value: appsText,
            onChange: (event) => {
              setAppsText(event.target.value);
              setAppsDirty(true);
            },
          }),
          customAppsError ? h('span', { className: 'naiwa-hint' }, customAppsError) : null,
        ),
        h(
          'div',
          { key: 'meta', className: 'naiwa-field' },
          h('span', null, t('panel.desktop')),
          h(
            'span',
            { className: 'naiwa-hint' },
            snapshot?.desktop?.running
              ? t('panel.desktopRunning')
              : snapshot?.desktop?.electron
                ? t('panel.desktopStopped')
                : t('panel.desktopMissing'),
          ),
          h('span', { className: 'naiwa-hint' }, t('panel.configPath') + ': ' + (snapshot?.configPath ?? '')),
        ),
      ];

      if (page) {
        return h(
          'div',
          { className: 'naiwa-settings-page' },
          h('h3', null, t('panel.title')),
          h('p', null, t('settings.lead')),
          h('div', { className: 'naiwa-settings-card' }, body),
          h(
            'div',
            { className: 'naiwa-actions' },
            appsDirty ? h('button', { type: 'button', onClick: applyApps }, t('panel.save')) : null,
            status ? h('span', { className: 'naiwa-hint' }, status) : null,
          ),
        );
      }

      return h(
        'div',
        { className: 'naiwa-panel', style: { right: '20px', bottom: '20px', left: 'auto', top: 'auto' } },
        h('h3', null, t('panel.title')),
        body,
        h(
          'div',
          { className: 'naiwa-actions' },
          appsDirty ? h('button', { type: 'button', onClick: applyApps }, t('panel.save')) : null,
          h('button', { type: 'button', onClick: props.onClose }, t('panel.close')),
        ),
      );
    }

    function NaiwaPet(props) {
      const t = typeof props.t === 'function' ? props.t : (key) => key;
      const lang = t('lang') === 'en' ? 'en' : 'zh';
      const layerRef = useRef(null);
      const stageRef = useRef(null);
      const flipRef = useRef(null);
      const tiltRef = useRef(null);
      const bodyRef = useRef(null);
      const shadowRef = useRef(null);
      const bubbleRef = useRef(null);
      const menuRef = useRef(null);
      const petRef = useRef(null);

      const [ready, setReady] = useState(false);
      const [bursts, setBursts] = useState([]);
      const [outfits, setOutfits] = useState([]);
      const [frames, setFrames] = useState({ ...BASE_FRAMES });
      const [menu, setMenu] = useState(null);
      const [panel, setPanel] = useState(false);
      const [frameHeight, setFrameHeight] = useState(Math.round(168 * DEFAULT_FRAME_RATIO));
      const seqRef = useRef(0);
      const squashTimerRef = useRef(0);
      const bubbleTimerRef = useRef(0);

      const { snapshot, save } = useHostConfig();
      const config = snapshot?.config ?? null;
      const displayMode = config?.displayMode ?? 'app';
      const visible = displayMode === 'app' || displayMode === 'both';

      useEffect(() => {
        loadOutfitIndex()
          .then((index) => {
            if (Array.isArray(index?.outfits)) setOutfits(index.outfits);
          })
          .catch((err) => console.warn('[dsh-naiwa-pet] outfit index unavailable: ' + String(err)));
      }, []);

      const activeOutfit = (() => {
        if (!config) return null;
        return outfits.find((outfit) => outfit.id === config.activeOutfit) ?? outfits[0] ?? null;
      })();

      useEffect(() => {
        let alive = true;
        if (!activeOutfit) {
          setFrames({ ...BASE_FRAMES });
          return () => {
            alive = false;
          };
        }
        resolveOutfitFrames(activeOutfit)
          .then((next) => {
            if (alive) setFrames({ front: next.front, 'front-closed': next['front-closed'], side: next.side });
          })
          .catch(() => {
            if (alive) setFrames({ ...BASE_FRAMES });
          });
        return () => {
          alive = false;
        };
      }, [activeOutfit]);

      const paint = useCallback((view) => {
        const stage = stageRef.current;
        const flip = flipRef.current;
        const tilt = tiltRef.current;
        const body = bodyRef.current;
        const shadow = shadowRef.current;
        if (!stage || !flip || !tilt || !body || !shadow) return;
        stage.style.transform = 'translate3d(' + view.x.toFixed(2) + 'px,' + view.y.toFixed(2) + 'px,0)';
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

        const floorTop = view.floorY + view.stageH - 8;
        const air = Math.max(0, view.floorY - view.y);
        const k = Math.min(1, air / 320);
        shadow.style.transform =
          'translate3d(' +
          (view.x + view.size / 2 - 56).toFixed(1) +
          'px,' +
          floorTop.toFixed(1) +
          'px,0) scale(' +
          (1 - 0.32 * k).toFixed(3) +
          ',' +
          (1 - 0.2 * k).toFixed(3) +
          ')';
        shadow.style.opacity = String(0.85 - 0.5 * k);
        setFrameHeight((prev) => (prev === view.stageH ? prev : view.stageH));
      }, []);

      const speak = useCallback(
        (key, ms) => {
          const bubble = bubbleRef.current;
          if (!bubble) return;
          const text = t(key);
          if (!text || text === key) return;
          bubble.textContent = text;
          bubble.classList.add('show');
          clearTimeout(bubbleTimerRef.current);
          bubbleTimerRef.current = window.setTimeout(
            () => {
              bubble.classList.remove('show');
            },
            ms == null ? 2400 : ms,
          );
        },
        [t],
      );

      const burst = useCallback((kind) => {
        const id = ++seqRef.current;
        const parts = [];
        if (kind === 'hearts') {
          const glyphs = ['💛', '🧡', '💛', '✨'];
          for (let i = 0; i < 6; i += 1) {
            parts.push({
              glyph: glyphs[i % glyphs.length],
              left: (48 + rand(-18, 18)).toFixed(1) + '%',
              top: (24 + rand(-6, 6)).toFixed(1) + '%',
              dx: rand(-48, 48).toFixed(0) + 'px',
              delay: Math.round(rand(0, 170)),
              size: Math.round(rand(13, 19)),
            });
          }
        } else {
          for (let i = 0; i < 5; i += 1) {
            parts.push({
              glyph: '',
              left: (50 + rand(-16, 16)).toFixed(1) + '%',
              top: '',
              dx: rand(-26, 26).toFixed(0) + 'px',
              delay: Math.round(rand(0, 60)),
              size: Math.round(rand(7, 13)),
            });
          }
        }
        setBursts((prev) => [...prev.slice(-3), { id, kind, parts }]);
        window.setTimeout(() => setBursts((prev) => prev.filter((item) => item.id !== id)), 1400);
      }, []);

      const flashClass = useCallback((name, ms) => {
        const body = bodyRef.current;
        if (!body) return;
        body.classList.remove(name);
        void body.offsetWidth;
        body.classList.add(name);
        window.setTimeout(() => body.classList.remove(name), ms);
      }, []);

      // 宠物核心只创建一次：之后靠 setter 响应配置变化。
      useEffect(() => {
        const pet = createPet({
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
          motion: 'dom',
          size: config ? config.petSize : 168,
          frameRatio: DEFAULT_FRAME_RATIO,
          initial: loadSavedPosition() ?? undefined,
          requestFrame: (callback) => window.requestAnimationFrame(callback),
          cancelFrame: (id) => window.cancelAnimationFrame(id),
          bounds: () => ({ width: window.innerWidth, height: window.innerHeight }),
          now: () => performance.now(),
          onPaint: paint,
          onBubble: speak,
          onBurst: burst,
          onPersist: persistPosition,
          onEvent: (type) => {
            if (type === 'squash') {
              flashClass('is-squash', 300);
            } else if (type === 'spin') {
              flashClass('is-spin', 850);
            } else if (type === 'hop') {
              flashClass('is-hop', 440);
            }
          },
        });
        petRef.current = pet;
        pet.start();
        setReady(true);
        pingHost('overlay');
        const onResize = () => pet.resize();
        window.addEventListener('resize', onResize);
        return () => {
          window.removeEventListener('resize', onResize);
          pet.stop();
          petRef.current = null;
          clearTimeout(squashTimerRef.current);
          clearTimeout(bubbleTimerRef.current);
        };
      }, []);

      // 配置热更新：大小 / 自动动作间隔 / 服饰。
      useEffect(() => {
        const pet = petRef.current;
        if (!pet) return;
        if (config) {
          pet.setSize(config.petSize);
          pet.setOutfit(config.activeOutfit);
          pet.paint();
        }
      }, [config]);

      useEffect(() => {
        const pet = petRef.current;
        if (!pet) return;
        const next = config ? config.autoActionInterval : undefined;
        pet.setIntervalSource(() => next);
      }, [config]);

      useEffect(() => {
        const pet = petRef.current;
        if (pet) pet.setFrames(frames);
      }, [frames]);

      // 右键菜单 / 设置面板的关闭逻辑。
      useEffect(() => {
        if (!menu && !panel) return undefined;
        const onDown = (event) => {
          const menuNode = menuRef.current;
          if (menuNode && menuNode.contains(event.target)) return;
          if (event.target && event.target.closest && event.target.closest('.naiwa-panel')) return;
          setMenu(null);
          setPanel(false);
        };
        const onKey = (event) => {
          if (event.key === 'Escape') {
            setMenu(null);
            setPanel(false);
          }
        };
        window.addEventListener('pointerdown', onDown, true);
        window.addEventListener('keydown', onKey);
        return () => {
          window.removeEventListener('pointerdown', onDown, true);
          window.removeEventListener('keydown', onKey);
        };
      }, [menu, panel]);

      const openMenu = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        const pet = petRef.current;
        if (pet && pet.state().dragging) pet.pointerCancel({});
        setPanel(false);
        const width = 190;
        const height = 320;
        setMenu({
          x: Math.min(event.clientX, window.innerWidth - width - 12),
          y: Math.min(event.clientY, Math.max(12, window.innerHeight - height)),
        });
      }, []);

      const setActiveOutfit = useCallback(
        async (id) => {
          setMenu(null);
          await save({ activeOutfit: id }).catch((err) =>
            console.warn('[dsh-naiwa-pet] outfit save failed ' + String(err)),
          );
        },
        [save],
      );

      const setDisplayMode = useCallback(
        async (mode) => {
          setMenu(null);
          await save({ displayMode: mode }).catch((err) =>
            console.warn('[dsh-naiwa-pet] mode save failed ' + String(err)),
          );
        },
        [save],
      );

      const openApp = useCallback(
        async (id) => {
          setMenu(null);
          try {
            await launchApp(id);
          } catch (err) {
            console.warn('[dsh-naiwa-pet] launch failed: ' + String(err));
            speak('panel.launchFailed', 1800);
          }
        },
        [speak],
      );

      const pointerPoint = (event) => ({
        x: event.clientX,
        y: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        pointerId: event.pointerId,
        time: performance.now(),
      });

      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        setMenu(null);
        setPanel(false);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* 指针捕获失败时仍可用 window 级兜底 */
        }
        const pet = petRef.current;
        if (pet) pet.pointerDown(pointerPoint(event));
      };

      const onPointerMove = (event) => {
        const pet = petRef.current;
        if (pet) pet.pointerMove(pointerPoint(event));
      };

      const onPointerUp = (event) => {
        const pet = petRef.current;
        if (pet) pet.pointerUp(pointerPoint(event));
      };

      const onPointerCancel = (event) => {
        const pet = petRef.current;
        if (pet) pet.pointerCancel(pointerPoint(event));
      };

      const activeMenuGroups = menu
        ? [
            {
              id: 'actions',
              label: t('menu.actions'),
              items: ACTION_ORDER.map((id) => ({
                id: 'action:' + id,
                label: t('menu.action.' + id),
                run: () => {
                  setMenu(null);
                  petRef.current?.playAction(id);
                },
              })),
            },
            {
              id: 'outfits',
              label: t('menu.outfits'),
              items: outfits.map((outfit) => ({
                id: 'outfit:' + outfit.id,
                label: labelText(outfit.name, lang) + (config && config.activeOutfit === outfit.id ? ' ✓' : ''),
                run: () => setActiveOutfit(outfit.id),
              })),
            },
            {
              id: 'expressions',
              label: t('menu.expressions'),
              items: Object.values(EXPRESSIONS).map((expression) => ({
                id: 'expression:' + expression.id,
                label: t('menu.expression.' + expression.id),
                run: () => {
                  setMenu(null);
                  petRef.current?.setExpression(expression.id);
                },
              })),
            },
            {
              id: 'apps',
              label: t('menu.apps'),
              items: [...BUILTIN_APPS, ...((config && config.customApps) || [])].map((app) => ({
                id: 'app:' + app.id,
                label: labelText(typeof app.label === 'string' ? app.label : app.label, lang),
                run: () => openApp(app.id),
              })),
            },
            {
              id: 'position',
              label: t('menu.position'),
              items: POSITION_MODES.map((mode) => ({
                id: 'mode:' + mode.id,
                label: t('menu.position.' + mode.id) + (displayMode === mode.id ? ' ✓' : ''),
                run: () => setDisplayMode(mode.id),
              })),
            },
          ]
        : [];

      const trailingMenu = [
        {
          id: 'settings',
          label: t('menu.settings'),
          run: () => {
            setMenu(null);
            setPanel(true);
          },
        },
        { id: 'quit', label: t('menu.quit'), run: () => setDisplayMode('none') },
      ];

      const layerStyle = { display: visible ? '' : 'none' };

      return h(
        'div',
        { ref: layerRef, className: 'naiwa-layer', 'aria-hidden': 'true', style: layerStyle },
        h('style', null, PET_CSS + MENU_CSS),
        h('div', { ref: shadowRef, className: 'naiwa-shadow' }),
        h(
          'div',
          {
            ref: stageRef,
            className: 'naiwa-stage',
            style: {
              width: config ? config.petSize + 'px' : '168px',
              height: frameHeight + 'px',
              opacity: ready ? 1 : 0,
              transition: 'opacity .25s ease',
            },
          },
          h(
            'div',
            { ref: flipRef, className: 'naiwa-flip' },
            h(
              'div',
              { ref: tiltRef, className: 'naiwa-tilt' },
              h(
                'div',
                { ref: bodyRef, className: 'naiwa-body', 'data-mode': 'idle', 'data-face': 'front' },
                h('img', { className: 'naiwa-img naiwa-front', src: frames.front, alt: '', draggable: false }),
                h('img', { className: 'naiwa-img naiwa-side', src: frames.side, alt: '', draggable: false }),
                h('img', {
                  className: 'naiwa-img naiwa-closed',
                  src: frames['front-closed'],
                  alt: '',
                  draggable: false,
                }),
                h('div', { className: 'naiwa-blush' }),
              ),
            ),
          ),
          h('div', { ref: bubbleRef, className: 'naiwa-bubble' }),
          h(BurstLayer, { bursts }),
          h('div', {
            className: 'naiwa-hit',
            role: 'presentation',
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onContextMenu: openMenu,
          }),
        ),
        menu
          ? h(
              'div',
              {
                ref: menuRef,
                className: 'naiwa-menu',
                style: { left: menu.x + 'px', top: menu.y + 'px' },
                onContextMenu: (event) => event.preventDefault(),
              },
              activeMenuGroups.map((group) =>
                h(
                  'div',
                  { key: group.id, className: 'naiwa-menu-item' },
                  h(
                    'button',
                    { type: 'button', className: 'naiwa-menu-button' },
                    h('span', null, group.label),
                    h('span', { className: 'naiwa-menu-arrow' }, '▸'),
                  ),
                  h(
                    'div',
                    { className: 'naiwa-submenu' },
                    group.items.map((item) =>
                      h(
                        'button',
                        {
                          key: item.id,
                          type: 'button',
                          className: 'naiwa-menu-button',
                          onClick: item.run,
                        },
                        h('span', null, item.label),
                      ),
                    ),
                  ),
                ),
              ),
              h('div', { className: 'naiwa-menu-sep' }),
              trailingMenu.map((item) =>
                h(
                  'button',
                  { key: item.id, type: 'button', className: 'naiwa-menu-button', onClick: item.run },
                  h('span', null, item.label),
                ),
              ),
            )
          : null,
        panel && visible
          ? h(SettingsForm, {
              t,
              snapshot,
              save,
              outfits,
              onClose: () => setPanel(false),
            })
          : null,
      );
    }

    function NaiwaSettingsSection(props) {
      const t = props.t;
      const { snapshot, save } = useHostConfig();
      const [outfits, setOutfits] = useState([]);
      useEffect(() => {
        loadOutfitIndex()
          .then((index) => {
            if (Array.isArray(index?.outfits)) setOutfits(index.outfits);
          })
          .catch(() => setOutfits([]));
        pingHost('settings');
      }, []);
      return h(
        React.Fragment,
        null,
        h('style', null, MENU_CSS),
        h(SettingsForm, { t, snapshot, save, outfits, page: true }),
      );
    }

    return {
      name: 'naiwa-pet',
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => {
          const disposers = [];
          try {
            disposers.push(ctx.locale.register(NS, 'zh', ZH));
            disposers.push(ctx.locale.register(NS, 'en', EN));
          } catch (error) {
            console.warn('[dsh-naiwa-pet] 文案注册失败（宠物仍可用，气泡走 key 兜底）: ' + String(error));
          }
          return () => {
            for (const dispose of disposers) dispose();
          };
        }, 'dsh-naiwa-pet: dictionaries');

        const t = ctx.locale.bind(NS);

        ctx.slots.inject('shell.overlay', function* () {
          yield ctx.slots.register({ name: 'shell.overlay', id: 'naiwa-pet', order: 1200 }, () => h(NaiwaPet, { t }));
        });

        ctx.slots.inject('settings.section', function* () {
          yield ctx.slots.register(
            { name: 'settings.section', id: 'naiwa-pet', order: SETTINGS_ORDER, label: () => t('settings.title') },
            () => h(NaiwaSettingsSection, { t }),
          );
        });
      },
    };
  },
});
