/**
 * dsh-naiwa-pet —— 宿主半侧。
 *
 * 职责（v0.2）：
 *   1. 把包内 assets/ 以只读 HTTP 前缀路由暴露给浏览器半侧（含 outfits/<dir>/<file>）
 *   2. 维护用户配置 $DSH_HOME/dsh-naiwa-pet/config.json（GET/POST，热更新）
 *   3. 只按固定 ID 打开外部应用（POST /launch，绝不执行用户传入的命令行）
 *   4. 按 displayMode 启停桌面 Electron 壳（透明置顶窗）
 *
 * 安全模型：素材是只读 GET；所有会改变机器状态的 POST 都要求
 *   - 只接受 loopback Host
 *   - Origin（如果存在）必须与 Host 一致
 *   - 必须带 X-Naiwa-Pet: 1 且 Content-Type: application/json
 * 浏览器跨站请求无法伪造这三个条件（会先触发 CORS 预检，而本路由拒绝 OPTIONS）。
 */
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, watch, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, resolve, sep } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROUTE_PREFIX = '/dsh-naiwa-pet-7341';
export const CONFIG_DIR_NAME = 'dsh-naiwa-pet';
export const DISPLAY_MODES = ['app', 'desktop', 'both', 'none'];
export const DEFAULT_CONFIG = Object.freeze({
  displayMode: 'app',
  petSize: 168,
  activeOutfit: 'classic',
  autoActionInterval: '2800-6400',
  customApps: [],
});

const PACKAGE_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ASSET_DIR = resolve(PACKAGE_DIR, 'assets');
const DESKTOP_MAIN = join(PACKAGE_DIR, 'desktop', 'main.cjs');
const BODY_LIMIT = 64 * 1024;

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

/** 内置启动器：id → 固定动作，永不接受外部传入的命令。 */
export const BUILTIN_LAUNCHERS = Object.freeze({
  'deepseek-web': { id: 'deepseek-web', label: 'DeepSeek Web', type: 'url', target: 'https://chat.deepseek.com' },
  'dsh-local': { id: 'dsh-local', label: 'DeepSeek Harness', type: 'self', target: '/' },
});

/** webServer 服务是硬依赖：没有它就没法把素材交给页面。 */
export const inject = ['webServer'];

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

export function dshHomeDir() {
  return process.env.DSH_HOME || join(process.env.USERPROFILE || process.env.HOME || homedir(), '.dsh');
}

export function resolveConfigPath() {
  return join(dshHomeDir(), CONFIG_DIR_NAME, 'config.json');
}

function clampInt(value, min, max, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeInterval(value, fallback) {
  if (Array.isArray(value) && value.length === 2) {
    const min = Math.max(400, clampInt(value[0], 400, 600000, 2800));
    return [min, Math.max(min, clampInt(value[1], 400, 600000, 6400))];
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const single = clampInt(value, 400, 600000, 2800);
    return [single, single];
  }
  if (typeof value === 'string') {
    const parts = value.split('-').map((part) => Number(part.trim()));
    if (parts.length === 2 && parts.every((part) => Number.isFinite(part))) {
      const min = Math.max(400, clampInt(parts[0], 400, 600000, 2800));
      return [min, Math.max(min, clampInt(parts[1], 400, 600000, 6400))];
    }
  }
  return fallback;
}

export function normalizeCustomApps(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const ids = new Set();
  for (const entry of value.slice(0, 24)) {
    if (!entry || typeof entry !== 'object') continue;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!/^[a-z0-9][a-z0-9._-]{0,31}$/.test(id) || ids.has(id)) continue;
    const type = entry.type === 'exec' ? 'exec' : 'url';
    const target = typeof entry.target === 'string' ? entry.target.trim() : '';
    if (!target || target.length > 512 || /[\u0000\r\n]/.test(target)) continue;
    if (type === 'url' && !/^https?:\/\//i.test(target)) continue;
    const label = (typeof entry.label === 'string' ? entry.label : id).slice(0, 80);
    const args =
      type === 'exec' && Array.isArray(entry.args)
        ? entry.args
            .filter((arg) => typeof arg === 'string' && arg.length <= 256 && !/[\u0000\r\n]/.test(arg))
            .slice(0, 16)
        : [];
    ids.add(id);
    out.push({ id, label, type, target, ...(args.length > 0 ? { args } : {}) });
  }
  return out;
}

/** 把任意输入归一成合法配置；未知字段丢弃。 */
export function normalizeConfig(raw, defaults = DEFAULT_CONFIG) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const merged = { ...defaults, ...source };
  return {
    displayMode: DISPLAY_MODES.includes(merged.displayMode) ? merged.displayMode : (defaults.displayMode ?? 'app'),
    petSize: clampInt(merged.petSize, 80, 360, defaults.petSize ?? 168),
    activeOutfit:
      typeof merged.activeOutfit === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(merged.activeOutfit)
        ? merged.activeOutfit
        : (defaults.activeOutfit ?? 'classic'),
    autoActionInterval: normalizeInterval(
      merged.autoActionInterval,
      normalizeInterval(defaults.autoActionInterval, [2800, 6400]),
    ).join('-'),
    customApps: normalizeCustomApps(merged.customApps ?? defaults.customApps),
  };
}

/** 读写 config.json：每次读都从磁盘取最新内容，手动编辑也能被页面轮询到。 */
export class ConfigStore {
  constructor(options = {}) {
    this.file = options.path || resolveConfigPath();
    this.defaults = normalizeConfig(options.defaults || DEFAULT_CONFIG);
    this.logger = options.logger || console;
  }

  dir() {
    const parts = this.file.split(/[\\/]/);
    parts.pop();
    return parts.join(sep);
  }

  read() {
    try {
      return normalizeConfig(JSON.parse(readFileSync(this.file, 'utf8')), this.defaults);
    } catch {
      return normalizeConfig(this.defaults);
    }
  }

  write(patch) {
    const next = normalizeConfig(
      { ...this.read(), ...(patch && typeof patch === 'object' ? patch : {}) },
      this.defaults,
    );
    mkdirSync(this.dir(), { recursive: true });
    const temporary = this.file + '.tmp';
    writeFileSync(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8');
    renameSync(temporary, this.file);
    return next;
  }

  watch(listener) {
    let timer = 0;
    let watcher;
    try {
      watcher = watch(this.dir(), { persistent: false }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            listener(this.read());
          } catch (error) {
            this.logger.warn?.('[dsh-naiwa-pet] config watch failed: ' + String(error));
          }
        }, 120);
      });
      watcher.on?.('error', () => {});
    } catch {
      return () => {};
    }
    return () => {
      clearTimeout(timer);
      watcher.close();
    };
  }
}

// ---------------------------------------------------------------------------
// 启动器
// ---------------------------------------------------------------------------

/** 只按 ID 查固定表；未知 id 返回 undefined，绝不把 id 当命令执行。 */
export function resolveLauncher(id, config) {
  if (typeof id !== 'string') return undefined;
  if (BUILTIN_LAUNCHERS[id]) return BUILTIN_LAUNCHERS[id];
  if (!config || !Array.isArray(config.customApps)) return undefined;
  return config.customApps.find((app) => app.id === id);
}

/** 打开默认浏览器 / 系统应用的固定 argv（shell: false）。 */
export function openerArgs(target, platform = process.platform) {
  if (platform === 'win32') return { command: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', target] };
  if (platform === 'darwin') return { command: 'open', args: [target] };
  return { command: 'xdg-open', args: [target] };
}

export function openExternal(target, spawnImpl = spawn) {
  if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) {
    throw new Error('dsh-naiwa-pet: only http(s) URLs can be opened externally');
  }
  if (typeof target === 'string' && /[\u0000\r\n]/.test(target)) {
    throw new Error('dsh-naiwa-pet: invalid URL');
  }
  const { command, args } = openerArgs(target);
  const child = spawnImpl(command, args, { shell: false, detached: true, stdio: 'ignore', windowsHide: true });
  child.on?.('error', () => {});
  child.unref?.();
  return true;
}

export function launchExec(target, args, spawnImpl = spawn) {
  const child = spawnImpl(target, Array.isArray(args) ? args : [], {
    shell: false,
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.on?.('error', () => {});
  child.unref?.();
  return true;
}

/** 解析 Electron 可执行文件；找不到时返回 undefined（设置页会显示未安装）。 */
export function resolveElectronPath() {
  const override = process.env.DSH_NAIWA_ELECTRON_PATH;
  if (override && existsSync(override)) return override;
  const landing = join(dshHomeDir(), 'electron');
  const candidates =
    process.platform === 'win32'
      ? [join(landing, 'electron.exe')]
      : process.platform === 'darwin'
        ? [join(landing, 'Electron.app', 'Contents', 'MacOS', 'Electron')]
        : [join(landing, 'electron')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  const localDist =
    process.platform === 'win32'
      ? join(PACKAGE_DIR, 'node_modules', 'electron', 'dist', 'electron.exe')
      : process.platform === 'darwin'
        ? join(PACKAGE_DIR, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron')
        : join(PACKAGE_DIR, 'node_modules', 'electron', 'dist', 'electron');
  return existsSync(localDist) ? localDist : undefined;
}

// ---------------------------------------------------------------------------
// HTTP 工具
// ---------------------------------------------------------------------------

function sendText(res, status, text, headers) {
  const body = Buffer.from(text, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * 素材白名单：
 *   <file>                       assets 下一层文件（原有三帧 / sprite.json）
 *   outfits/index.json           换装索引
 *   outfits/<dir>/<file>         换装帧（一层目录 + 一层文件）
 * 仍然拒绝 ..、反斜杠、空段和未知扩展名。
 */
export function safeAssetName(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith(ROUTE_PREFIX + '/')) return undefined;
  const rest = pathname.slice(ROUTE_PREFIX.length + 1);
  let decoded;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    return undefined;
  }
  if (decoded.startsWith('assets/')) decoded = decoded.slice('assets/'.length);
  if (decoded.length === 0) return undefined;
  if (decoded.includes('\\') || decoded.includes('\0')) return undefined;
  if (/[\u0000-\u001f]/.test(decoded)) return undefined;
  const parts = decoded.split('/');
  const validFile = (name) => {
    if (!name || name === '.' || name === '..') return false;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(name)) return false;
    return Boolean(MIME[extname(name).toLowerCase()]);
  };
  if (parts.length === 1) return validFile(parts[0]) ? parts[0] : undefined;
  if (parts[0] !== 'outfits') return undefined;
  if (parts.length === 2) return validFile(parts[1]) ? decoded : undefined;
  if (parts.length !== 3) return undefined;
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(parts[1])) return undefined;
  if (!validFile(parts[2])) return undefined;
  return decoded;
}

function isTrustedMutation(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '::1') return false;
  const origin = req.headers.origin;
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host.toLowerCase() !== host) return false;
    } catch {
      return false;
    }
  }
  if (req.headers['x-naiwa-pet'] !== '1') return false;
  const contentType = String(req.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  return contentType === 'application/json';
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        rejectBody(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        rejectBody(new Error('invalid JSON'));
      }
    });
    req.on('error', rejectBody);
  });
}

// ---------------------------------------------------------------------------
// 宿主插件
// ---------------------------------------------------------------------------

/**
 * @param {any} ctx Cordis 上下文
 * @param {any} pluginConfig cordis.patch.yml 里的 config
 */
export function apply(ctx, pluginConfig) {
  const store = new ConfigStore({
    defaults: pluginConfig || DEFAULT_CONFIG,
    path: pluginConfig && pluginConfig.__configPath,
  });
  let desktopChild = null;
  let lastOrigin = '';
  /** 浏览器半侧挂载自检：DSH 形态是否真的渲染起来了（排查“注册了但没显示”最有用）。 */
  let lastClientPing = null;

  const desktopState = () => {
    const electron = resolveElectronPath();
    return { running: Boolean(desktopChild), electron: electron ?? null };
  };

  const stopDesktop = () => {
    if (!desktopChild) return;
    try {
      desktopChild.kill();
    } catch {
      /* 已退出 */
    }
    desktopChild = null;
  };

  const startDesktop = () => {
    if (desktopChild) return true;
    const electron = resolveElectronPath();
    if (!electron) return false;
    const args = [DESKTOP_MAIN, '--config', store.file];
    if (lastOrigin) args.push('--web-url', lastOrigin);
    const env = { ...process.env, DSH_HOME: dshHomeDir() };
    delete env.ELECTRON_RUN_AS_NODE;
    try {
      desktopChild = spawn(electron, args, { shell: false, detached: false, stdio: 'ignore', env, cwd: PACKAGE_DIR });
    } catch (error) {
      console.warn('[dsh-naiwa-pet] desktop spawn failed: ' + String(error));
      desktopChild = null;
      return false;
    }
    desktopChild.on?.('exit', () => {
      desktopChild = null;
    });
    desktopChild.on?.('error', () => {
      desktopChild = null;
    });
    return true;
  };

  const syncDesktop = (config) => {
    if (config.displayMode === 'desktop' || config.displayMode === 'both') {
      if (!startDesktop()) {
        // Electron 缺失时退回应用内显示，避免把宠物彻底藏没。
        if (config.displayMode === 'desktop') store.write({ displayMode: 'app' });
      }
    } else {
      stopDesktop();
    }
  };

  const snapshot = () => ({
    config: store.read(),
    configPath: store.file,
    desktop: desktopState(),
    client: lastClientPing,
  });

  const ensureOrigin = (req) => {
    const host = String(req.headers.host || '');
    if (host) lastOrigin = 'http://' + host;
    return lastOrigin;
  };

  const launch = (id, config) => {
    const launcher = resolveLauncher(id, config);
    if (!launcher) return false;
    if (launcher.type === 'url') {
      openExternal(launcher.target);
      return true;
    }
    if (launcher.type === 'self') {
      if (!lastOrigin) return false;
      openExternal(lastOrigin + '/');
      return true;
    }
    if (launcher.type === 'exec') {
      launchExec(launcher.target, launcher.args || []);
      return true;
    }
    return false;
  };

  async function serveAsset(req, res) {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      sendText(res, 405, 'dsh-naiwa-pet: method not allowed', { Allow: 'GET, HEAD' });
      return;
    }
    let pathname = '/';
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      sendText(res, 400, 'dsh-naiwa-pet: bad request');
      return;
    }
    ensureOrigin(req);
    const name = safeAssetName(pathname);
    if (name === undefined) {
      sendText(res, 404, 'dsh-naiwa-pet: asset not found');
      return;
    }
    const file = resolve(ASSET_DIR, name);
    if (file !== ASSET_DIR && !file.startsWith(ASSET_DIR + sep)) {
      sendText(res, 404, 'dsh-naiwa-pet: asset not found');
      return;
    }
    let info;
    try {
      info = await stat(file);
    } catch {
      sendText(res, 404, 'dsh-naiwa-pet: asset not found');
      return;
    }
    if (!info.isFile()) {
      sendText(res, 404, 'dsh-naiwa-pet: asset not found');
      return;
    }
    const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
    const headers = {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
    };
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    if (method === 'HEAD') {
      res.end();
      return;
    }
    const stream = createReadStream(file);
    stream.on('error', () => {
      if (!res.headersSent) sendText(res, 500, 'dsh-naiwa-pet: read failed');
      else res.destroy();
    });
    stream.pipe(res);
  }

  async function serveApi(req, res) {
    const method = req.method ?? 'GET';
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    ensureOrigin(req);

    if (pathname === ROUTE_PREFIX + '/config' || pathname === ROUTE_PREFIX + '/config/') {
      if (method === 'GET') {
        sendJson(res, 200, snapshot());
        return;
      }
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
      }
      if (!isTrustedMutation(req)) {
        sendJson(res, 403, { error: 'untrusted request' });
        return;
      }
      let patch;
      try {
        patch = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
        return;
      }
      const next = store.write(patch);
      syncDesktop(next);
      sendJson(res, 200, snapshot());
      return;
    }

    if (pathname === ROUTE_PREFIX + '/ping' || pathname === ROUTE_PREFIX + '/ping/') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
      }
      if (!isTrustedMutation(req)) {
        sendJson(res, 403, { error: 'untrusted request' });
        return;
      }
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
        return;
      }
      const part = body && typeof body.part === 'string' ? body.part.slice(0, 40) : 'unknown';
      lastClientPing = { part, at: Date.now() };
      sendJson(res, 200, { ok: true });
      return;
    }

    if (pathname === ROUTE_PREFIX + '/launch' || pathname === ROUTE_PREFIX + '/launch/') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
      }
      if (!isTrustedMutation(req)) {
        sendJson(res, 403, { error: 'untrusted request' });
        return;
      }
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
        return;
      }
      const id = body && typeof body.id === 'string' ? body.id : '';
      if (!id || !resolveLauncher(id, store.read())) {
        sendJson(res, 404, { error: 'unknown app id' });
        return;
      }
      try {
        launch(id, store.read());
      } catch (error) {
        sendJson(res, 500, { error: String(error && error.message ? error.message : error), id });
        return;
      }
      sendJson(res, 200, { ok: true, id });
      return;
    }

    if (pathname === ROUTE_PREFIX + '/desktop' || pathname === ROUTE_PREFIX + '/desktop/') {
      if (method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
      }
      if (!isTrustedMutation(req)) {
        sendJson(res, 403, { error: 'untrusted request' });
        return;
      }
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: String(error && error.message ? error.message : error) });
        return;
      }
      const action = body && body.action;
      if (action === 'start') {
        const started = startDesktop();
        if (!started) {
          sendJson(res, 409, { error: 'electron not found', desktop: desktopState() });
          return;
        }
      } else if (action === 'stop') {
        stopDesktop();
      } else {
        sendJson(res, 400, { error: 'action must be start or stop' });
        return;
      }
      sendJson(res, 200, snapshot());
      return;
    }

    sendJson(res, 404, { error: 'not found' });
  }

  const route = async (req, res) => {
    try {
      const pathname = (() => {
        try {
          return new URL(req.url ?? '/', 'http://localhost').pathname;
        } catch {
          return '/';
        }
      })();
      if (pathname.startsWith(ROUTE_PREFIX + '/')) {
        if (
          pathname === ROUTE_PREFIX + '/config' ||
          pathname.startsWith(ROUTE_PREFIX + '/config/') ||
          pathname === ROUTE_PREFIX + '/ping' ||
          pathname.startsWith(ROUTE_PREFIX + '/ping/') ||
          pathname === ROUTE_PREFIX + '/launch' ||
          pathname.startsWith(ROUTE_PREFIX + '/launch/') ||
          pathname === ROUTE_PREFIX + '/desktop' ||
          pathname.startsWith(ROUTE_PREFIX + '/desktop/')
        ) {
          await serveApi(req, res);
          return;
        }
        await serveAsset(req, res);
        return;
      }
      sendText(res, 404, 'dsh-naiwa-pet: not found');
    } catch (error) {
      if (!res.headersSent)
        sendText(res, 500, 'dsh-naiwa-pet: ' + (error instanceof Error ? error.message : String(error)));
      else if (!res.writableEnded) res.destroy();
    }
  };

  const disposers = [];
  disposers.push(ctx.webServer.register({ kind: 'prefix', path: ROUTE_PREFIX, handler: route }));

  const disposeWatch = store.watch(() => syncDesktop(store.read()));
  disposers.push(disposeWatch);

  // 启动时按已保存配置决定桌面形态是否拉起。
  syncDesktop(store.read());

  ctx.effect(
    () => () => {
      stopDesktop();
      for (const dispose of disposers.reverse()) {
        try {
          dispose?.();
        } catch {
          /* 已释放 */
        }
      }
    },
    'dsh-naiwa-pet: routes, config watch and desktop supervisor',
  );
}
