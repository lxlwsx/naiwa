import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { Writable } from 'node:stream';

import { apply, DEFAULT_CONFIG, ROUTE_PREFIX as P } from '../naiwa-pet/index.js';
import { assetsDir } from './support.mjs';

const RESPONSE_TIMEOUT_MS = 2000;
const temp = mkdtempSync(join(tmpdir(), 'naiwa-route-'));
const configPath = join(temp, 'dsh-naiwa-pet', 'config.json');

function mount() {
  let route;
  let disposer;
  const ctx = {
    effect(fn) {
      disposer = fn();
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
  apply(ctx, { __configPath: configPath });
  assert.ok(route, 'apply() must register the prefix route');
  return { route, dispose: () => (typeof disposer === 'function' ? disposer() : undefined) };
}

const mounted = mount();
const route = mounted.route;

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
    res.on('finish', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  });
  return { res, finished };
}

function makeRequest({ method = 'GET', url, headers = {}, body }) {
  const chunks =
    body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body), 'utf8')];
  const stream = Readable.from(chunks);
  stream.method = method;
  stream.url = url;
  stream.headers = headers;
  return stream;
}

async function call(request) {
  const { res, finished } = makeResponse();
  const timeout = new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('route did not finish: ' + request.url)), RESPONSE_TIMEOUT_MS);
    timer.unref?.();
  });
  await route.handler(request, res);
  return Promise.race([finished, timeout]);
}

const hostHeaders = { host: '127.0.0.1:62987' };
const mutationHeaders = {
  ...hostHeaders,
  origin: 'http://127.0.0.1:62987',
  'content-type': 'application/json',
  'x-naiwa-pet': '1',
};

test('route is a prefix route on the plugin-specific path', () => {
  assert.equal(route.kind, 'prefix');
  assert.equal(route.path, P);
});

test('serves a sprite frame with correct bytes, type and cache headers', async () => {
  const response = await call(makeRequest({ url: P + '/assets/naiwa-front.png', headers: hostHeaders }));
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'image/png');
  assert.equal(response.headers['Cache-Control'], 'no-cache');
  assert.match(response.headers.ETag, /^W\/"[0-9a-f]+-[0-9a-f]+"$/);
  const expected = readFileSync(join(assetsDir, 'naiwa-front.png'));
  assert.equal(Number(response.headers['Content-Length']), expected.length);
  assert.deepEqual(response.body, expected);
});

test('serves the outfit index as JSON', async () => {
  const response = await call(makeRequest({ url: P + '/assets/outfits/index.json', headers: hostHeaders }));
  assert.equal(response.status, 200);
  assert.match(response.headers['Content-Type'], /application\/json/);
  const parsed = JSON.parse(response.body.toString('utf8'));
  assert.ok(Array.isArray(parsed.outfits));
});

test('revalidates with the weak ETag and answers 304 without a body', async () => {
  const first = await call(makeRequest({ url: P + '/assets/naiwa-side.png', headers: hostHeaders }));
  const second = await call(
    makeRequest({
      url: P + '/assets/naiwa-side.png',
      headers: { ...hostHeaders, 'if-none-match': first.headers.ETag },
    }),
  );
  assert.equal(second.status, 304);
  assert.equal(second.body.length, 0);
});

test('HEAD returns headers only and non-read methods are rejected', async () => {
  const head = await call(
    makeRequest({ method: 'HEAD', url: P + '/assets/naiwa-front-closed.png', headers: hostHeaders }),
  );
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  const post = await call(makeRequest({ method: 'POST', url: P + '/assets/naiwa-front.png', headers: hostHeaders }));
  assert.equal(post.status, 405);
  assert.equal(post.headers.Allow, 'GET, HEAD');
});

test('refuses path traversal and unsupported extensions', async () => {
  const blocked = [
    P + '/assets/%2e%2e%2findex.js',
    P + '/assets/..%2findex.js',
    P + '/..%2findex.js',
    P + '/assets/..%5Cindex.js',
    P + '/assets/README.md',
    P + '/assets/outfits/../index.js',
    P + '/assets/naiva-front.png',
    '/other-prefix/assets/naiwa-front.png',
  ];
  for (const url of blocked) {
    const response = await call(makeRequest({ url, headers: hostHeaders }));
    assert.equal(response.status, 404, 'expected 404 for ' + url);
  }
});

test('config GET returns the normalized config, path and desktop status', async () => {
  const response = await call(makeRequest({ url: P + '/config', headers: hostHeaders }));
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body.toString('utf8'));
  assert.deepEqual(payload.config, DEFAULT_CONFIG);
  assert.equal(payload.configPath, configPath);
  assert.ok('running' in payload.desktop);
});

test('config POST without the CSRF fence is refused', async () => {
  const cases = [
    { url: P + '/config', headers: { ...hostHeaders, 'content-type': 'application/json' }, body: { petSize: 200 } },
    {
      url: P + '/config',
      headers: {
        ...hostHeaders,
        origin: 'http://evil.example',
        'content-type': 'application/json',
        'x-naiwa-pet': '1',
      },
      body: { petSize: 200 },
    },
    {
      url: P + '/config',
      headers: { ...hostHeaders, origin: 'http://127.0.0.1:62987', 'x-naiwa-pet': '1' },
      body: { petSize: 200 },
    },
    {
      url: P + '/config',
      headers: { ...hostHeaders, origin: 'http://127.0.0.1:62987', 'content-type': 'text/plain', 'x-naiwa-pet': '1' },
      body: { petSize: 200 },
    },
  ];
  for (const request of cases) {
    const response = await call(makeRequest({ method: 'POST', ...request }));
    assert.equal(response.status, 403, 'expected 403 for ' + JSON.stringify(request.headers));
  }
});

test('config POST writes the file and the GET reflects it', async () => {
  const response = await call(
    makeRequest({
      method: 'POST',
      url: P + '/config',
      headers: mutationHeaders,
      body: { petSize: 222, displayMode: 'app' },
    }),
  );
  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body.toString('utf8'));
  assert.equal(payload.config.petSize, 222);
  assert.equal(JSON.parse(readFileSync(configPath, 'utf8')).petSize, 222);
  const reread = await call(makeRequest({ url: P + '/config', headers: hostHeaders }));
  assert.equal(JSON.parse(reread.body.toString('utf8')).config.petSize, 222);
});

test('config POST rejects malformed JSON', async () => {
  const response = await call(
    makeRequest({ method: 'POST', url: P + '/config', headers: mutationHeaders, body: '{not json' }),
  );
  assert.equal(response.status, 400);
});

test('launch refuses unknown ids with 404 and never executes them', async () => {
  const response = await call(
    makeRequest({ method: 'POST', url: P + '/launch', headers: mutationHeaders, body: { id: 'rm -rf /' } }),
  );
  assert.equal(response.status, 404);
  assert.match(response.body.toString('utf8'), /unknown app id/);
});

test('launch requires the CSRF fence before it looks at the id', async () => {
  const response = await call(
    makeRequest({ method: 'POST', url: P + '/launch', headers: hostHeaders, body: { id: 'deepseek-web' } }),
  );
  assert.equal(response.status, 403);
});

test('desktop control rejects unknown actions', async () => {
  const response = await call(
    makeRequest({ method: 'POST', url: P + '/desktop', headers: mutationHeaders, body: { action: 'explode' } }),
  );
  assert.equal(response.status, 400);
});

test('client ping requires the fence and is reported back in /config', async () => {
  const untrusted = await call(
    makeRequest({ method: 'POST', url: P + '/ping', headers: hostHeaders, body: { part: 'overlay' } }),
  );
  assert.equal(untrusted.status, 403);
  const ping = await call(
    makeRequest({ method: 'POST', url: P + '/ping', headers: mutationHeaders, body: { part: 'overlay' } }),
  );
  assert.equal(ping.status, 200);
  const snapshot = await call(makeRequest({ url: P + '/config', headers: hostHeaders }));
  const payload = JSON.parse(snapshot.body.toString('utf8'));
  assert.equal(payload.client.part, 'overlay');
  assert.ok(payload.client.at > 0);
});

test('unknown API paths are 404', async () => {
  const response = await call(makeRequest({ url: P + '/nope', headers: hostHeaders }));
  assert.equal(response.status, 404);
});

test.after(() => {
  mounted.dispose();
  rmSync(temp, { recursive: true, force: true });
});
