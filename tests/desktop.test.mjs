import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { pluginDir, repoRoot } from './support.mjs';

const require = createRequire(import.meta.url);
const { step, createBody, DEFAULT_PHYSICS } = require('../naiwa-pet/desktop/window-physics.cjs');

const AREA = { x: 0, y: 0, width: 1280, height: 800 };
const SIZE = { width: 168, height: 250 };
const MAX_Y = AREA.height - SIZE.height;

function run(body, frames, options) {
  let current = body;
  const events = [];
  for (let index = 0; index < frames; index += 1) {
    const result = step(current, 1 / 60, AREA, SIZE, options);
    current = result.body;
    events.push(result);
    if (result.settled) break;
  }
  return { body: current, events };
}

test('physics constants match the v0.2 tuning', () => {
  assert.equal(DEFAULT_PHYSICS.gravity, 2400);
  assert.equal(DEFAULT_PHYSICS.wallRestitution, 0.55);
  assert.equal(DEFAULT_PHYSICS.floorRestitution, 0.35);
});

test('a dropped window falls, bounces once and settles on the work-area floor', () => {
  const { body, events } = run(createBody({ x: 200, y: 0, vx: 40, vy: 0 }), 600);
  assert.ok(Math.abs(body.y - MAX_Y) < 1, 'window must settle on the floor, y=' + body.y);
  assert.equal(body.vy, 0);
  assert.equal(body.vx, 0);
  assert.ok(
    events.some((event) => event.impact),
    'floor impact must be reported for the squash animation',
  );
  assert.ok(events[events.length - 1].settled);
});

test('a hard throw bounces off the right wall and loses energy', () => {
  const start = createBody({ x: 100, y: MAX_Y, vx: 1800, vy: -600 });
  const { events } = run(start, 400);
  const wallHit = events.find((event) => event.impact && event.body.x >= AREA.width - SIZE.width - 0.5);
  assert.ok(wallHit, 'expected a right-wall impact');
  assert.ok(wallHit.body.vx < 0, 'wall bounce must reverse horizontal velocity');
  assert.ok(Math.abs(wallHit.body.vx) < 1800 * 0.6, 'wall bounce must lose energy');
});

test('a ceiling hit reverses vertical velocity with its own restitution', () => {
  const { events } = run(createBody({ x: 300, y: 2, vx: 0, vy: -1200 }), 2);
  const hit = events.find((event) => event.impact && event.body.y <= 0.5);
  assert.ok(hit, 'expected a ceiling impact');
  assert.ok(hit.body.vy > 0);
});

test('huge frame times are clamped instead of teleporting the window', () => {
  const result = step(createBody({ x: 300, y: 100, vx: 0, vy: 0 }), 5, AREA, SIZE);
  assert.ok(result.body.y <= MAX_Y);
  assert.ok(result.body.y - 100 < 260, 'dt must clamp to 50ms, delta=' + (result.body.y - 100));
});

test('generated desktop renderer is fresh and embeds the shared core', () => {
  const check = spawnSync(process.execPath, ['scripts/build-client.mjs', '--check'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  if (check.status !== 0) {
    spawnSync(process.execPath, ['scripts/build-client.mjs', '--check'], { cwd: repoRoot, stdio: 'inherit' });
  }
  assert.equal(check.status, 0, 'generated bundles must match their sources (run npm run build)');

  const bundle = readFileSync(join(pluginDir, 'desktop', 'pet-app.js'), 'utf8');
  assert.match(bundle, /createPet\(/);
  assert.match(bundle, /petBridge/);
  assert.doesNotMatch(bundle, /^\s*(import|export)\s/m);
});

test('desktop shell declares the transparent always-on-top window contract', () => {
  const main = readFileSync(join(pluginDir, 'desktop', 'main.cjs'), 'utf8');
  for (const token of [
    'transparent: true',
    'frame: false',
    'alwaysOnTop: true',
    "setAlwaysOnTop(true, 'screen-saver')",
    'skipTaskbar: true',
    "argValue('--config')",
    'window-physics.cjs',
    'shell: false',
    'pet:show-menu',
    'pet:move-by',
    'pet:throw',
  ]) {
    assert.ok(main.includes(token), 'desktop/main.cjs is missing: ' + token);
  }
  assert.doesNotMatch(main, /shell\s*:\s*true/);
});

test('preload exposes only the minimal bridge surface', () => {
  const preload = readFileSync(join(pluginDir, 'desktop', 'preload.cjs'), 'utf8');
  for (const method of ['getState', 'moveBy', 'throwWindow', 'showMenu', 'writeConfig', 'onState', 'onMotion']) {
    assert.ok(preload.includes(method + ':'), 'preload bridge is missing ' + method);
  }
  assert.doesNotMatch(preload, /exposeInMainWorld\(['"]require/);
  assert.doesNotMatch(preload, /nodeIntegration:\s*true/);
});

test('desktop page loads the generated bundle into #pet-root', () => {
  const html = readFileSync(join(pluginDir, 'desktop', 'pet.html'), 'utf8');
  assert.match(html, /id="pet-root"/);
  assert.match(html, /<script src="\.\/pet-app\.js"><\/script>/);
  assert.match(html, /background: transparent/);
});

test('window physics module is shipped and independent of Electron', () => {
  const source = readFileSync(join(pluginDir, 'desktop', 'window-physics.cjs'), 'utf8');
  assert.doesNotMatch(source, /require\(['"]electron['"]\)/);
  assert.ok(existsSync(join(pluginDir, 'desktop', 'window-physics.cjs')));
});
