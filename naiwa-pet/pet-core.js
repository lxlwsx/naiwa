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

export const CORE_VERSION = 2;
export const FRAME_NAMES = ['front', 'front-closed', 'side'];
export const DEFAULT_FRAME_RATIO = 768 / 640;

/** 宠物本体 CSS。菜单/设置面板的样式属于适配层，不在这里。 */
export const PET_CSS = `
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
export function parseInterval(value, fallback = [2800, 6400]) {
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

export function frameUrls(assetBase, outfit, frameName) {
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
export function createPet(options = {}) {
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
