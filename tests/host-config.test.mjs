import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ConfigStore,
  DEFAULT_CONFIG,
  ROUTE_PREFIX,
  normalizeConfig,
  normalizeCustomApps,
  openerArgs,
  resolveLauncher,
  safeAssetName,
} from '../naiwa-pet/index.js';

const P = ROUTE_PREFIX;

test('default config keeps the documented v0.2 defaults', () => {
  assert.deepEqual(DEFAULT_CONFIG, {
    displayMode: 'app',
    petSize: 168,
    activeOutfit: 'classic',
    autoActionInterval: '2800-6400',
    customApps: [],
  });
});

test('normalizeConfig clamps and rejects unknown values', () => {
  const normalized = normalizeConfig({
    displayMode: 'everywhere',
    petSize: 999,
    activeOutfit: '../evil',
    autoActionInterval: [2000, 5000],
    customApps: [],
    extra: 'dropped',
  });
  assert.equal(normalized.displayMode, 'app');
  assert.equal(normalized.petSize, 360);
  assert.equal(normalized.activeOutfit, 'classic');
  assert.equal(normalized.autoActionInterval, '2000-5000');
  assert.equal('extra' in normalized, false);

  assert.equal(normalizeConfig({ petSize: 10 }).petSize, 80);
  assert.equal(normalizeConfig({ displayMode: 'both' }).displayMode, 'both');
});

test('custom apps are whitelisted by shape and id grammar', () => {
  const apps = normalizeCustomApps([
    { id: 'vscode', label: 'VS Code', type: 'exec', target: 'code', args: ['-n'] },
    { id: 'bad id', label: 'x', type: 'url', target: 'https://example.com' },
    { id: 'ftp', label: 'x', type: 'url', target: 'ftp://example.com' },
    { id: 'web', label: 'Web', type: 'url', target: 'https://example.com' },
    { id: 'vscode', label: 'dup', type: 'exec', target: 'code' },
    { id: 'evil', label: 'x', type: 'exec', target: 'cmd\u0000' },
  ]);
  assert.deepEqual(
    apps.map((app) => app.id),
    ['vscode', 'web'],
  );
  assert.deepEqual(apps[0].args, ['-n']);
});

test('ConfigStore reads defaults when missing and round-trips patches atomically', () => {
  const dir = mkdtempSync(join(tmpdir(), 'naiwa-config-'));
  const file = join(dir, 'dsh-naiwa-pet', 'config.json');
  const store = new ConfigStore({ path: file });
  assert.deepEqual(store.read(), DEFAULT_CONFIG);
  assert.deepEqual(store.write({ petSize: 220 }), { ...DEFAULT_CONFIG, petSize: 220 });
  assert.deepEqual(store.read(), { ...DEFAULT_CONFIG, petSize: 220 });
  assert.deepEqual(
    store.write({
      displayMode: 'both',
      customApps: [{ id: 'web', label: 'Web', type: 'url', target: 'https://example.com' }],
    }).displayMode,
    'both',
  );
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(raw.petSize, 220);
  assert.equal(raw.customApps[0].id, 'web');
  assert.deepEqual(readdirSync(join(dir, 'dsh-naiwa-pet')).sort(), ['config.json'], 'no temp file may be left behind');
  rmSync(dir, { recursive: true, force: true });
});

test('only fixed launcher ids resolve, never arbitrary strings', () => {
  const config = { customApps: [{ id: 'vscode', label: 'VS Code', type: 'exec', target: 'code', args: [] }] };
  assert.equal(resolveLauncher('deepseek-web', config).type, 'url');
  assert.equal(resolveLauncher('dsh-local', config).type, 'self');
  assert.equal(resolveLauncher('vscode', config).type, 'exec');
  assert.equal(resolveLauncher('missing', config), undefined);
  assert.equal(resolveLauncher('code; rm -rf /', config), undefined);
  assert.equal(resolveLauncher(undefined, config), undefined);
});

test('opening a URL uses fixed argv per platform, never a shell string', () => {
  assert.deepEqual(openerArgs('https://chat.deepseek.com', 'win32'), {
    command: 'rundll32.exe',
    args: ['url.dll,FileProtocolHandler', 'https://chat.deepseek.com'],
  });
  assert.deepEqual(openerArgs('https://chat.deepseek.com', 'darwin'), {
    command: 'open',
    args: ['https://chat.deepseek.com'],
  });
  assert.deepEqual(openerArgs('https://chat.deepseek.com', 'linux'), {
    command: 'xdg-open',
    args: ['https://chat.deepseek.com'],
  });
});

test('asset allowlist accepts outfits one level deep and still blocks traversal', () => {
  const ok = [
    P + '/assets/naiwa-front.png',
    P + '/assets/sprite.json',
    P + '/assets/outfits/index.json',
    P + '/assets/outfits/hanfu-spring/front.png',
    P + '/assets/outfits/hanfu-spring/front-closed.png',
    P + '/outfits/hanfu-winter/side.png',
  ];
  for (const url of ok) assert.ok(safeAssetName(url), 'expected an allowed asset: ' + url);

  const blocked = [
    P + '/assets/../index.js',
    P + '/assets/outfits/../index.js',
    P + '/assets/outfits/hanfu-spring/../../index.js',
    P + '/assets/outfits/hanfu-spring/front.txt',
    P + '/assets/outfits/Hanfu-Spring/front.png',
    P + '/assets/outfits/hanfu-spring/extra/front.png',
    P + '/assets/outfits/README.md',
    P + '/assets/README.md',
    P + '/assets/%00.png',
    '/other/assets/naiwa-front.png',
  ];
  for (const url of blocked) assert.equal(safeAssetName(url), undefined, 'expected a rejected asset: ' + url);
});
