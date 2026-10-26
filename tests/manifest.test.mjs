import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { listFiles, matchGlob, pluginDir, pluginRelative, pngInfo, readJson } from './support.mjs';

const pkg = readJson(join(pluginDir, 'package.json'));
const patch = readFileSync(join(pluginDir, 'cordis.patch.yml'), 'utf8');

test('manifest declares the bundle id and public entry points', () => {
  assert.equal(pkg.name, 'dsh-naiwa-pet');
  assert.equal(pkg.type, 'module');
  assert.ok(pkg.version, 'version is required for install_bundle');
  assert.deepEqual(Object.keys(pkg.exports).sort(), ['.', './client', './icon', './locale/*.json'].sort());
  assert.equal(pkg.exports['.'], './index.js');
  assert.equal(pkg.exports['./client'], './client.js');
});

test('manifest marks the package as a DSH bundle with a web client half', () => {
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
  assert.equal(pkg.dsh?.client?.platform, 'web');
  assert.equal(pkg.dsh?.client?.immediately, true, 'the pet must load without waiting for a slot request');
});

test('bundle patch inserts exactly one row named after the package', () => {
  assert.match(patch, /^- insert:/m);
  const ids = patch.match(/^\s*-\s*id:\s*(\S+)\s*$/gm) ?? [];
  const names = patch.match(/^\s+name:\s*'([^']+)'\s*$/gm) ?? [];
  assert.equal(ids.length, 1, 'patch must insert one row, found: ' + ids.join(', '));
  assert.equal(names.length, 1, 'patch row must name one module');
  assert.match(ids[0], /dsh-naiwa-pet/);
  assert.match(names[0], /dsh-naiwa-pet/);
});

test('published file list covers every runtime artifact', () => {
  const declared = pkg.files ?? [];
  assert.ok(Array.isArray(declared) && declared.length > 0, 'files list is required for packaging');
  // package.json is always included by npm and never needs a files entry.
  const runtime = listFiles(pluginDir)
    .map(pluginRelative)
    .filter((file) => file !== 'package.json');
  const uncovered = runtime.filter((file) => !declared.some((pattern) => matchGlob(pattern, file)));
  assert.deepEqual(uncovered, [], 'files list misses: ' + uncovered.join(', '));
});

test('plugin icon exists and stays inside plugin-manager limits', () => {
  const iconPath = join(pluginDir, pkg.icon ?? '');
  assert.ok(existsSync(iconPath), 'declared icon is missing: ' + pkg.icon);
  const info = pngInfo(iconPath);
  assert.equal(info.width, 512);
  assert.equal(info.height, 512);
  assert.equal(info.colorType, 6, 'icon must be RGBA');
  assert.ok(info.bytes <= 256 * 1024, 'icon must be <= 256 KiB, got ' + info.bytes);
});

test('both locales expose plugin-manager display metadata', () => {
  for (const locale of ['zh', 'en']) {
    const dict = readJson(join(pluginDir, 'locale', locale + '.json'));
    assert.equal(typeof dict.meta?.title, 'string', locale + ' meta.title');
    assert.equal(typeof dict.meta?.description, 'string', locale + ' meta.description');
    assert.ok(dict.meta.title.trim().length > 0, locale + ' meta.title must not be blank');
    assert.ok(dict.meta.description.trim().length > 0, locale + ' meta.description must not be blank');
  }
});
