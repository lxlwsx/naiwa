import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assetsDir, pluginDir, repoRoot } from './support.mjs';

const clientPath = join(pluginDir, 'client.js');
const hostPath = join(pluginDir, 'index.js');
const client = readFileSync(clientPath, 'utf8');
const host = readFileSync(hostPath, 'utf8');
const hostPrefix = host.match(/const ROUTE_PREFIX = '([^']+)'/)?.[1];

test('client half loads through the module system under the package name', () => {
  assert.match(client, /window\.__ModuleLoader__\.load\(\{/);
  assert.match(client, /id:\s*'dsh-naiwa-pet'/);
  assert.ok(hostPrefix, 'host half must declare ROUTE_PREFIX');
});

test('client half is a side-effect script without top-level ESM syntax', () => {
  assert.doesNotMatch(client, /^\s*import\s/m, 'client.js must not use ESM imports');
  assert.doesNotMatch(client, /^\s*export\s/m, 'client.js must not use ESM exports');
});

test('client registers exactly one overlay entry owned by this plugin', () => {
  assert.match(client, /ctx\.slots\.inject\('shell\.overlay'/);
  assert.match(client, /name:\s*'shell\.overlay'/);
  assert.match(client, /id:\s*'naiwa-pet'/);
  assert.match(client, /order:\s*1200/);
});

test('client contributes the pet settings section', () => {
  assert.match(client, /ctx\.slots\.inject\('settings\.section'/);
  assert.match(client, /name:\s*'settings\.section'/);
  assert.match(client, /label:\s*\(\)\s*=>\s*t\('settings\.title'\)/);
});

test('asset base URL agrees with the host route prefix', () => {
  assert.ok(hostPrefix.startsWith('/dsh-naiwa-pet-'), 'route prefix must be plugin specific');
  assert.ok(client.includes("const ROUTE = '" + hostPrefix + "'"), 'client route must match the host prefix');
  assert.match(client, /const ASSET_BASE = ROUTE \+ '\/assets\/'/);
});

test('every base frame referenced by the client exists on disk', () => {
  const referenced = [...client.matchAll(/ASSET_BASE \+ '([^']+\.png)'/g)].map((match) => match[1]);
  assert.ok(
    referenced.length >= 3,
    'expected the client to reference all three base frames, saw: ' + referenced.join(', '),
  );
  for (const file of referenced) {
    assert.ok(existsSync(join(assetsDir, file)), 'referenced sprite is missing: ' + file);
  }
});

test('client resolves outfit frames and falls back to the base frames', () => {
  assert.match(client, /'outfits\/' \+ outfit\.dir/);
  assert.match(client, /BASE_FRAMES/);
  assert.match(client, /resolveOutfitFrames/);
});

test('client calls the host config, launch and desktop endpoints', () => {
  for (const endpoint of ["'/config'", "'/launch'", "'/assets/outfits/index.json'"]) {
    assert.ok(client.includes(endpoint), 'client is missing endpoint ' + endpoint);
  }
  assert.match(client, /'X-Naiwa-Pet':\s*'1'/);
});

test('client renders the shared data-driven right-click menu', () => {
  assert.match(client, /naiwa-menu/);
  assert.match(client, /onContextMenu/);
  assert.match(client, /ACTION_ORDER\.map/);
  assert.match(client, /Object\.values\(EXPRESSIONS\)/);
});

test('client releases frames, timers and listeners on unmount', () => {
  assert.match(client, /cancelAnimationFrame/);
  assert.match(client, /clearTimeout/);
  assert.match(client, /removeEventListener/);
  assert.match(client, /window\.removeEventListener\('resize'/);
  assert.match(client, /pet\.stop\(\)/);
});

test('client registers its own locale dictionaries', () => {
  assert.match(client, /const NS = 'naiwa\.pet'/);
  assert.match(client, /ctx\.locale\.register\(NS, 'zh'/);
  assert.match(client, /ctx\.locale\.register\(NS, 'en'/);
  assert.match(client, /ctx\.locale\.bind\(NS\)/);
});

test('generated client is fresh and embeds the shared core content', () => {
  const check = spawnSync(process.execPath, ['scripts/build-client.mjs', '--check'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });
  if (check.status !== 0) {
    spawnSync(process.execPath, ['scripts/build-client.mjs', '--check'], { cwd: repoRoot, stdio: 'inherit' });
  }
  assert.equal(check.status, 0, 'client.js must match its sources (run npm run build)');
  assert.match(client, /createPet\(/);
  assert.match(client, /PET_CSS/);
  assert.match(client, /const ACTIONS = \{/);
});

test('plugin stays isolated from other pet plugins', () => {
  assert.doesNotMatch(client, /dsh-pet-7340/);
  assert.doesNotMatch(host, /dsh-pet-7340/);
});

test('both halves and the desktop shell pass the Node syntax check', () => {
  const files = [
    clientPath,
    hostPath,
    join(pluginDir, 'content.js'),
    join(pluginDir, 'pet-core.js'),
    join(pluginDir, 'desktop', 'main.cjs'),
    join(pluginDir, 'desktop', 'preload.cjs'),
    join(pluginDir, 'desktop', 'window-physics.cjs'),
  ];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'ignore' });
    if (result.status !== 0) {
      spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    }
    assert.equal(result.status, 0, 'syntax error in ' + file);
  }
});
