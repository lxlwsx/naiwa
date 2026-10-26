import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { assetsDir, pluginDir } from './support.mjs';

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
  assert.doesNotMatch(client, /^\s*import\s+(?!\()/m, 'client.js must not use ESM imports');
  assert.doesNotMatch(client, /^\s*export\s+/m, 'client.js must not use ESM exports');
});

test('client registers exactly one overlay entry owned by this plugin', () => {
  assert.match(client, /ctx\.slots\.inject\('shell\.overlay'/);
  assert.match(client, /name:\s*'shell\.overlay'/);
  assert.match(client, /id:\s*'naiwa-pet'/);
  assert.match(client, /order:\s*1200/);
});

test('asset base URL agrees with the host route prefix', () => {
  assert.ok(hostPrefix.startsWith('/dsh-naiwa-pet-'), 'route prefix must be plugin specific');
  assert.match(client, new RegExp("const ASSET_BASE = '" + hostPrefix.replace(/[/-]/g, '\\$&') + "/assets/'"));
});

test('every sprite frame referenced by the client exists on disk', () => {
  const referenced = [...client.matchAll(/ASSET_BASE \+ '([^']+\.png)'/g)].map((match) => match[1]);
  assert.ok(referenced.length >= 3, 'expected the client to reference all three frames, saw: ' + referenced.join(', '));
  for (const file of referenced) {
    assert.ok(existsSync(join(assetsDir, file)), 'referenced sprite is missing: ' + file);
  }
  const onDisk = readdirSync(assetsDir).filter((name) => name.endsWith('.png'));
  for (const file of onDisk) {
    assert.ok(referenced.includes(file), 'sprite not used by the client: ' + file);
  }
});

test('client releases frames, timers and listeners on unmount', () => {
  assert.match(client, /cancelAnimationFrame/);
  assert.match(client, /clearTimeout/);
  assert.match(client, /removeEventListener/);
  assert.match(client, /removeEventListener\('pointermove'/);
  assert.match(client, /removeEventListener\('animationend'/);
});

test('client registers its own locale dictionaries', () => {
  assert.match(client, /const NS = 'naiwa\.pet'/);
  assert.match(client, /ctx\.locale\.register\(NS, 'zh'/);
  assert.match(client, /ctx\.locale\.register\(NS, 'en'/);
  assert.match(client, /ctx\.locale\.bind\(NS\)/);
});

test('plugin stays isolated from other pet plugins', () => {
  assert.doesNotMatch(client, /dsh-pet-7340/);
  assert.doesNotMatch(host, /dsh-pet-7340/);
});

test('both halves pass the Node syntax check', () => {
  for (const file of [clientPath, hostPath]) {
    // The DSH sandbox denies piped child stdio, so keep it silent and replay on failure.
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'ignore' });
    if (result.status !== 0) {
      spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    }
    assert.equal(result.status, 0, 'syntax error in ' + file);
  }
});
