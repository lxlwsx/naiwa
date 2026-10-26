/**
 * dsh-naiwa-pet —— 宿主半侧。
 *
 * 只做一件事：把包内 assets/ 下的图片以只读 HTTP 前缀路由暴露给浏览器半侧。
 * 浏览器插件（client.js）自己不带素材，靠这里的 /dsh-naiwa-pet-7341/assets/*.png
 * 取精灵帧；这样精灵图改了不用重新构建 client.js。
 *
 * 路由前缀带 7341 后缀，避免与生态里其它桌宠插件的裸路径撞车
 * （webServer 对重复的 (kind, path) 直接抛错，撞车会让整个插件起不来）。
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTE_PREFIX = '/dsh-naiwa-pet-7341';
const ASSET_DIR = resolve(fileURLToPath(new URL('./assets/', import.meta.url)));

const MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

/** webServer 服务是硬依赖：没有它就没法把素材交给页面。 */
export const inject = ['webServer'];

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

/** 只允许 assets/ 下一层的普通文件名，杜绝路径穿越。 */
function safeAssetName(pathname) {
  if (!pathname.startsWith(ROUTE_PREFIX + '/')) return undefined;
  const rest = pathname.slice(ROUTE_PREFIX.length + 1);
  let decoded;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    return undefined;
  }
  // 浏览器半侧用的是 /<prefix>/assets/<file>，这里也接受 /<prefix>/<file> 的短写法。
  if (decoded.startsWith('assets/')) decoded = decoded.slice('assets/'.length);
  if (decoded.length === 0) return undefined;
  if (decoded.includes('..') || decoded.includes('/') || decoded.includes('\\') || decoded.includes('\0')) {
    return undefined;
  }
  if (!MIME[extname(decoded).toLowerCase()]) return undefined;
  return decoded;
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 */
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

  const name = safeAssetName(pathname);
  if (name === undefined) {
    sendText(res, 404, 'dsh-naiwa-pet: asset not found');
    return;
  }

  const file = resolve(ASSET_DIR, name);
  if (!file.startsWith(ASSET_DIR + sep)) {
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

  // 素材很小，弱 ETag 足够；改了图 mtime 变，浏览器自然会拿到新版本。
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

/**
 * @param {any} ctx Cordis 上下文
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: async (req, res) => {
          try {
            await serveAsset(req, res);
          } catch (error) {
            if (!res.headersSent) {
              sendText(res, 500, 'dsh-naiwa-pet: ' + (error instanceof Error ? error.message : String(error)));
            } else if (!res.writableEnded) {
              res.destroy();
            }
          }
        },
      }),
    'dsh-naiwa-pet: asset route',
  );
}
