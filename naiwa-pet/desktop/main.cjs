'use strict';

/**
 * 奶娃桌宠 —— 桌面形态（Electron 主进程）。
 *
 * 一个透明、无边框、置顶、不进任务栏的小窗。窗口位置由这里的物理循环负责，
 * 渲染页只负责把宠物画出来、把手势上报；两边共享 content.js / pet-core.js，
 * 不维护第二套宠物状态机。
 *
 * 由 DSH 宿主按固定 argv 拉起：
 *   electron desktop/main.cjs --config <config.json> [--web-url <http://127.0.0.1:port>]
 * 也可以手动：electron desktop/main.cjs --config <config.json>
 */
// 运行在纯 Node 模式时 require('electron') 拿不到 app，先给出可读错误再退出。
if (process.env.ELECTRON_RUN_AS_NODE) {
  console.error('[naiwa-pet] refusing to run in ELECTRON_RUN_AS_NODE mode; unset it or use npm run desktop:start');
  process.exit(1);
}

const { app, BrowserWindow, Menu, ipcMain, screen, shell } = require('electron');
const { existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } = require('node:fs');
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createBody, step } = require('./window-physics.cjs');

const RATIO = 768 / 640;
const BUBBLE_SPACE = 48;
const FRAME_NAMES = ['front', 'front-closed', 'side'];
const WALK_SPEED = 58;
const DEFAULT_CONFIG = {
  displayMode: 'app',
  petSize: 168,
  activeOutfit: 'classic',
  autoActionInterval: '2800-6400',
  customApps: [],
};
const DISPLAY_MODES = ['app', 'desktop', 'both', 'none'];
const APP_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(APP_DIR, 'assets');

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && index + 1 < process.argv.length ? process.argv[index + 1] : undefined;
}

const configPath =
  argValue('--config') ||
  path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'dsh-naiwa-pet', 'config.json');
const webUrl = argValue('--web-url') || '';

const lang = (app.getLocale() || 'zh').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';

let petWindow = null;
let motionTimer = 0;
let wanderTimer = 0;
let settleTimer = 0;
let contentPromise = null;
let lastSelfWriteAt = 0;

function readConfig() {
  try {
    const parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      petSize: Math.min(360, Math.max(80, Number(parsed.petSize) || DEFAULT_CONFIG.petSize)),
      displayMode: DISPLAY_MODES.includes(parsed.displayMode) ? parsed.displayMode : DEFAULT_CONFIG.displayMode,
      customApps: Array.isArray(parsed.customApps) ? parsed.customApps : [],
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...(patch && typeof patch === 'object' ? patch : {}) };
  next.petSize = Math.min(360, Math.max(80, Math.round(Number(next.petSize) || DEFAULT_CONFIG.petSize)));
  if (!DISPLAY_MODES.includes(next.displayMode)) next.displayMode = DEFAULT_CONFIG.displayMode;
  try {
    mkdirSync(path.dirname(configPath), { recursive: true });
    const temporary = configPath + '.tmp';
    writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8');
    renameSync(temporary, configPath);
    lastSelfWriteAt = Date.now();
  } catch (error) {
    console.warn('[naiwa-pet] config write failed: ' + String(error));
  }
  return next;
}

function outfitsIndex() {
  try {
    const parsed = JSON.parse(readFileSync(path.join(ASSETS_DIR, 'outfits', 'index.json'), 'utf8'));
    if (Array.isArray(parsed.outfits) && parsed.outfits.length > 0) return parsed;
  } catch {
    /* 缺索引时用内置兜底 */
  }
  return { default: 'classic', outfits: [{ id: 'classic', name: { zh: '原色', en: 'Classic' }, dir: null }] };
}

function fileUrl(file) {
  return pathToFileURL(file).href;
}

function framesFor(config) {
  const base = {
    front: fileUrl(path.join(ASSETS_DIR, 'naiwa-front.png')),
    'front-closed': fileUrl(path.join(ASSETS_DIR, 'naiwa-front-closed.png')),
    side: fileUrl(path.join(ASSETS_DIR, 'naiwa-side.png')),
  };
  const index = outfitsIndex();
  const outfit = index.outfits.find((entry) => entry.id === config.activeOutfit) || index.outfits[0];
  if (!outfit || !outfit.dir) return base;
  const dir = path.join(ASSETS_DIR, 'outfits', outfit.dir);
  let allowed = null;
  try {
    const meta = JSON.parse(readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    if (Array.isArray(meta.frames) && meta.frames.length > 0) allowed = new Set(meta.frames);
  } catch {
    allowed = null;
  }
  const frames = { ...base };
  for (const name of FRAME_NAMES) {
    if (allowed && !allowed.has(name)) continue;
    const candidate = path.join(dir, name + '.png');
    if (existsSync(candidate)) frames[name] = fileUrl(candidate);
  }
  return frames;
}

function state() {
  const config = readConfig();
  return { config, frames: framesFor(config), outfits: outfitsIndex().outfits, webUrl };
}

function pushState() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.webContents.send('pet:state', state());
  }
}

function workArea() {
  if (!petWindow || petWindow.isDestroyed()) return screen.getPrimaryDisplay().workArea;
  // 用“窗口当前所在显示器”，不要用屏幕中心最近点：混合 DPI 的多显示器上
  // 让窗口在同一块屏内移动，才能避免 Windows 反复播放 DPI 变更动画（表现为窗口被不断放大）。
  return screen.getDisplayMatching(petWindow.getBounds()).workArea;
}

function windowSize(config) {
  const size = config.petSize;
  return { width: size, height: Math.round(size * RATIO) + BUBBLE_SPACE };
}

function clampIntoArea(x, y, size, area) {
  return {
    x: Math.min(area.x + area.width - size.width, Math.max(area.x, Math.round(x))),
    y: Math.min(area.y + area.height - size.height, Math.max(area.y, Math.round(y))),
  };
}

function applySize(config, keepCorner) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const size = windowSize(config);
  const bounds = petWindow.getBounds();
  if (bounds.width === size.width && bounds.height === size.height) return;
  const area = workArea();
  const anchored = keepCorner
    ? { x: bounds.x + bounds.width - size.width, y: bounds.y + bounds.height - size.height }
    : { x: bounds.x, y: bounds.y };
  const position = clampIntoArea(anchored.x, anchored.y, size, area);
  stopMotion();
  petWindow.setBounds({ x: position.x, y: position.y, width: size.width, height: size.height });
}

function applyConfig(options = {}) {
  const config = readConfig();
  const visible = config.displayMode === 'desktop' || config.displayMode === 'both';
  if (!visible && options.exitWhenHidden !== false) {
    app.quit();
    return;
  }
  applySize(config, true);
  pushState();
}

// ---------------------------------------------------------------------------
// 窗口运动：拖拽跟手 / 抛掷反弹 / 自动溜达
// ---------------------------------------------------------------------------

function stopMotion() {
  clearInterval(motionTimer);
  clearInterval(wanderTimer);
  clearTimeout(settleTimer);
  motionTimer = 0;
  wanderTimer = 0;
  settleTimer = 0;
}

function sendMotion(motion) {
  if (petWindow && !petWindow.isDestroyed()) petWindow.webContents.send('pet:motion', motion);
}

function moveWindow(x, y) {
  if (!petWindow || petWindow.isDestroyed()) return;
  const config = readConfig();
  const area = workArea();
  const size = windowSize(config);
  const position = clampIntoArea(x, y, size, area);
  petWindow.setBounds({ x: position.x, y: position.y, width: size.width, height: size.height });
}

function startPhysics(vx, vy) {
  if (!petWindow || petWindow.isDestroyed()) return;
  stopMotion();
  const config = readConfig();
  const size = windowSize(config);
  const [x, y] = petWindow.getPosition();
  let body = createBody({ x, y, vx: Number(vx) || 0, vy: Number(vy) || 0 });
  let last = Date.now();
  sendMotion({ mode: 'air' });
  motionTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) {
      stopMotion();
      return;
    }
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const area = workArea();
    const result = step(body, Math.min(0.05, dt), area, size);
    body = result.body;
    petWindow.setBounds({ x: Math.round(body.x), y: Math.round(body.y), width: size.width, height: size.height });
    if (result.impact) sendMotion({ mode: 'air', squash: true });
    if (result.settled) {
      stopMotion();
      sendMotion({ mode: 'idle' });
      scheduleWander();
    }
  }, 16);
}

function scheduleWander() {
  clearTimeout(settleTimer);
  if (!petWindow || petWindow.isDestroyed()) return;
  const delay = 4000 + Math.random() * 5000;
  settleTimer = setTimeout(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const config = readConfig();
    const size = windowSize(config);
    const area = workArea();
    const bounds = petWindow.getBounds();
    // 初始窗口故意离底边留 24px 视觉边距，所以“着地”要允许一个容差，否则永远不算落地。
    const gap = area.y + area.height - (bounds.y + bounds.height);
    if (gap > 64) {
      scheduleWander();
      return;
    }
    const targets = [area.x + 16, area.x + area.width - size.width - 16];
    let targetX = targets[Math.random() < 0.5 ? 0 : 1];
    if (Math.abs(targetX - bounds.x) < 60) targetX = targets[0] + targets[1] - targetX;
    const direction = targetX > bounds.x ? 1 : -1;
    sendMotion({ mode: 'walk', dir: direction === 1 ? -1 : 1 });
    let last = Date.now();
    // 低频、整像素地挪窗口：混合 DPI 屏上逐帧 setPosition 会触发 Windows 的
    // DPI 过渡动画（窗口被越放越大），8fps 的离散移动足够表现出“走过去”。
    wanderTimer = setInterval(() => {
      if (!petWindow || petWindow.isDestroyed()) {
        stopMotion();
        return;
      }
      const now = Date.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      const [x, y] = petWindow.getPosition();
      const nextX = x + direction * WALK_SPEED * dt;
      const reached = direction === 1 ? nextX >= targetX : nextX <= targetX;
      petWindow.setBounds({
        x: Math.round(clampIntoArea(reached ? targetX : nextX, y, size, area).x),
        y,
        width: size.width,
        height: size.height,
      });
      if (reached) {
        stopMotion();
        sendMotion({ mode: 'idle' });
        scheduleWander();
      }
    }, 120);
  }, delay);
}

// ---------------------------------------------------------------------------
// 右键菜单
// ---------------------------------------------------------------------------

function labelOf(label) {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[lang] || label.zh || label.en || '';
}

function launchApp(app) {
  if (!app) return;
  if (app.type === 'url') {
    if (/^https?:\/\//i.test(app.target)) shell.openExternal(app.target);
    return;
  }
  if (app.type === 'self') {
    if (webUrl) shell.openExternal(webUrl.endsWith('/') ? webUrl : webUrl + '/');
    return;
  }
  if (app.type === 'exec') {
    try {
      const child = spawn(app.target, Array.isArray(app.args) ? app.args : [], {
        shell: false,
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => {});
      child.unref();
    } catch (error) {
      console.warn('[naiwa-pet] launch failed: ' + String(error));
    }
  }
}

async function showMenu() {
  if (!petWindow || petWindow.isDestroyed()) return;
  const content = contentPromise ? await contentPromise.catch(() => null) : null;
  const config = readConfig();
  const outfits = outfitsIndex().outfits;
  const builtinApps = content && Array.isArray(content.BUILTIN_APPS) ? content.BUILTIN_APPS : [];
  const customApps = config.customApps || [];
  const actionIds = content && Array.isArray(content.ACTION_ORDER) ? content.ACTION_ORDER : [];

  const actions = content
    ? actionIds.map((id) => ({
        label: labelOf(content.ACTIONS[id] && content.ACTIONS[id].label),
        click: () => petWindow && petWindow.webContents.send('pet:action', id),
      }))
    : [];

  const expressions = content
    ? Object.values(content.EXPRESSIONS || {}).map((expression) => ({
        label: labelOf(expression.label),
        click: () => petWindow && petWindow.webContents.send('pet:expression', expression.id),
      }))
    : [];

  const outfitItems = outfits.map((outfit) => ({
    label: labelOf(outfit.name) + (config.activeOutfit === outfit.id ? ' ✓' : ''),
    click: () => {
      writeConfig({ activeOutfit: outfit.id });
      pushState();
    },
  }));

  const apps = [...builtinApps, ...customApps].map((entry) => {
    const enabled = entry.type !== 'self' || Boolean(webUrl);
    return {
      label: labelOf(entry.label) || entry.id,
      enabled,
      click: () => launchApp(entry),
    };
  });

  const positionItems = DISPLAY_MODES.map((mode) => ({
    label:
      mode === 'app'
        ? lang === 'en'
          ? 'In app only'
          : '仅应用内'
        : mode === 'desktop'
          ? lang === 'en'
            ? 'Desktop only'
            : '仅桌面'
          : mode === 'both'
            ? lang === 'en'
              ? 'Both'
              : '两者都显示'
            : lang === 'en'
              ? 'Hidden'
              : '都不显示',
    type: 'radio',
    checked: config.displayMode === mode,
    click: () => {
      writeConfig({ displayMode: mode });
      applyConfig();
    },
  }));

  const sizeItems = [128, 168, 208, 260, 320].map((size) => ({
    label: size + ' px',
    type: 'radio',
    checked: Math.abs(config.petSize - size) < 2,
    click: () => {
      writeConfig({ petSize: size });
      applyConfig();
    },
  }));

  const template = [
    { label: lang === 'en' ? 'Actions' : '动作', submenu: actions },
    { label: lang === 'en' ? 'Outfits' : '服饰', submenu: outfitItems },
    { label: lang === 'en' ? 'Expressions' : '表情', submenu: expressions },
    {
      label: lang === 'en' ? 'Open app' : '打开应用',
      submenu: apps.length > 0 ? apps : [{ label: '-', enabled: false }],
    },
    { type: 'separator' },
    { label: lang === 'en' ? 'Display' : '显示位置', submenu: positionItems },
    { label: lang === 'en' ? 'Pet settings' : '桌宠设置', submenu: sizeItems },
    {
      label: lang === 'en' ? 'Open config file' : '打开配置文件',
      click: () => shell.openPath(configPath),
    },
    { type: 'separator' },
    { label: lang === 'en' ? 'Quit' : '退出', click: () => app.quit() },
  ];

  Menu.buildFromTemplate(template).popup({ window: petWindow });
}

// ---------------------------------------------------------------------------
// 窗口与生命周期
// ---------------------------------------------------------------------------

function createWindow() {
  const config = readConfig();
  const size = windowSize(config);
  const area = screen.getPrimaryDisplay().workArea;
  const position = clampIntoArea(
    area.x + area.width - size.width - 24,
    area.y + area.height - size.height - 24,
    size,
    area,
  );

  petWindow = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    maximizable: false,
    minimizable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.setSkipTaskbar(true);
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  petWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  petWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  petWindow.once('ready-to-show', () => {
    if (!petWindow) return;
    petWindow.showInactive();
    pushState();
    scheduleWander();
  });
  petWindow.on('closed', () => {
    petWindow = null;
    app.quit();
  });

  // 监听要在 loadFile 之前注册：file:// 页面加载很快，晚注册会错过 did-finish-load。
  petWindow.webContents.on('did-finish-load', () => {
    pushState();
  });
  petWindow.loadFile(path.join(__dirname, 'pet.html'));
}

ipcMain.handle('pet:get-state', () => state());
ipcMain.on('pet:move-by', (_event, delta) => {
  if (!delta || !petWindow || petWindow.isDestroyed()) return;
  stopMotion();
  const [x, y] = petWindow.getPosition();
  moveWindow(x + (Number(delta.dx) || 0), y + (Number(delta.dy) || 0));
});
ipcMain.on('pet:throw', (_event, velocity) => {
  if (!velocity) return;
  startPhysics(velocity.vx, velocity.vy);
});
ipcMain.on('pet:show-menu', () => {
  showMenu().catch((error) => console.warn('[naiwa-pet] menu failed: ' + String(error)));
});
ipcMain.handle('pet:write-config', (_event, patch) => {
  const next = writeConfig(patch);
  const visible = next.displayMode === 'desktop' || next.displayMode === 'both';
  const touchesMode = patch && typeof patch === 'object' && Object.prototype.hasOwnProperty.call(patch, 'displayMode');
  applyConfig({ exitWhenHidden: false });
  if (touchesMode && !visible) setTimeout(() => app.quit(), 60);
  return { config: next, frames: framesFor(next), outfits: outfitsIndex().outfits, webUrl };
});

function watchConfig() {
  try {
    watch(path.dirname(configPath), { persistent: false }, () => {
      setTimeout(() => {
        if (!petWindow || petWindow.isDestroyed()) return;
        // 自己写配置触发的 watch 事件不负责“隐藏即退出”，只有外部编辑才收回窗口。
        applyConfig({ exitWhenHidden: Date.now() - lastSelfWriteAt > 800 });
      }, 120);
    });
  } catch {
    /* 目录还不存在时忽略；宿主写配置后热更新会重新触发 */
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (petWindow) petWindow.show();
  });
  app.whenReady().then(() => {
    contentPromise = import(pathToFileURL(path.join(APP_DIR, 'content.js')).href);
    watchConfig();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => stopMotion());
}
