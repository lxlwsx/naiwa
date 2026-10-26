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
