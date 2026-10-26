import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';

import { apply } from '../naiwa-pet/index.js';
import { assetsDir } from './support.mjs';

const PREFIX = '/dsh-naiwa-pet-7341';
const RESPONSE_TIMEOUT_MS = 2000;

function mount() {
  let route;
  const ctx = {
    effect(fn) {
      const disposer = fn();
      return () => disposer?.();
    },
    webServer: {
      register(candidate) {
        route = candidate;
        return () => {
          route = undefined;
        };
      },
    },
  };
  apply(ctx);
  assert.ok(route, 'apply() must register the asset route');
  return route;
}

function makeResponse() {
  const chunks = [];
  const res = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  res.statusCode = 0;
  res.headers = {};
  res.headersSent = false;
  res.writeHead = (status, headers = {}) => {
    res.statusCode = status;
    res.headers = headers;
    res.headersSent = true;
    return res;
  };
  const finished = new Promise((resolve) => {
    res.on('finish', () => {
      resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
    });
  });
  return { res, finished };
}

async function call(route, { method = 'GET', url, headers = {} }) {
  const { res, finished } = makeResponse();
  const timeout = new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('route did not finish the response: ' + url)), RESPONSE_TIMEOUT_MS);
    timer.unref?.();
  });
  await route.handler({ method, url, headers }, res);
  return Promise.race([finished, timeout]);
}

const route = mount();

test('route is a prefix route on the plugin-specific path', () => {
  assert.equal(route.kind, 'prefix');
  assert.equal(route.path, PREFIX);
});

test('serves a sprite frame with correct bytes, type and cache headers', async () => {
  const response = await call(route, { url: PREFIX + '/assets/naiwa-front.png' });
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'image/png');
  assert.equal(response.headers['Cache-Control'], 'no-cache');
  assert.match(response.headers.ETag, /^W\/"[0-9a-f]+-[0-9a-f]+"$/);
  const expected = readFileSync(join(assetsDir, 'naiwa-front.png'));
  assert.equal(Number(response.headers['Content-Length']), expected.length);
  assert.deepEqual(response.body, expected);
});

test('revalidates with the weak ETag and answers 304 without a body', async () => {
  const first = await call(route, { url: PREFIX + '/assets/naiwa-side.png' });
  const etag = first.headers.ETag;
  const second = await call(route, { url: PREFIX + '/assets/naiwa-side.png', headers: { 'if-none-match': etag } });
  assert.equal(second.status, 304);
  assert.equal(second.body.length, 0);
});

test('HEAD returns headers only', async () => {
  const response = await call(route, { method: 'HEAD', url: PREFIX + '/assets/naiwa-front-closed.png' });
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 0);
  assert.ok(Number(response.headers['Content-Length']) > 0);
});

test('rejects non-read methods', async () => {
  const response = await call(route, { method: 'POST', url: PREFIX + '/assets/naiwa-front.png' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.Allow, 'GET, HEAD');
});

test('refuses path traversal and unsupported extensions', async () => {
  const blocked = [
    PREFIX + '/assets/%2e%2e%2findex.js',
    PREFIX + '/assets/..%2findex.js',
    PREFIX + '/..%2findex.js',
    PREFIX + '/assets/..%5Cindex.js',
    PREFIX + '/assets/README.md',
    PREFIX + '/assets/naiva-front.png',
    '/other-prefix/assets/naiwa-front.png',
  ];
  for (const url of blocked) {
    const response = await call(route, { url });
    assert.equal(response.status, 404, 'expected 404 for ' + url);
    assert.match(response.body.toString('utf8'), /asset not found/);
  }
});
