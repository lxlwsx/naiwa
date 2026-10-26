/**
 * static-analysis gate: syntax check every JS/MJS unit, parse JSON, verify the
 * patch YAML shape and probe PNG headers. Child processes use silent stdio
 * because the DSH sandbox denies piped child IO.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const fail = (message) => failures.push(message);

function listByExtension(dir, extension) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listByExtension(full, extension));
    else if (entry.name.endsWith(extension)) out.push(full);
  }
  return out;
}

function checkSyntax(files) {
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], { stdio: 'ignore' });
    if (result.status !== 0) {
      spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
      fail('syntax error: ' + file);
    }
  }
  return files.length;
}

const jsFiles = [
  join(repoRoot, 'naiwa-pet', 'index.js'),
  join(repoRoot, 'naiwa-pet', 'client.js'),
  join(repoRoot, 'eslint.config.mjs'),
  join(repoRoot, 'commitlint.config.mjs'),
  ...listByExtension(join(repoRoot, 'scripts'), '.mjs'),
  ...listByExtension(join(repoRoot, 'tests'), '.mjs'),
];
const syntaxCount = checkSyntax(jsFiles);

const jsonFiles = [
  join(repoRoot, 'package.json'),
  join(repoRoot, 'naiwa-pet', 'package.json'),
  join(repoRoot, 'naiwa-pet', 'assets', 'sprite.json'),
  join(repoRoot, 'naiwa-pet', 'locale', 'zh.json'),
  join(repoRoot, 'naiwa-pet', 'locale', 'en.json'),
];
for (const file of jsonFiles) {
  try {
    JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail('invalid JSON in ' + file + ': ' + error.message);
  }
}

const patch = readFileSync(join(repoRoot, 'naiwa-pet', 'cordis.patch.yml'), 'utf8');
if (!/^- insert:/m.test(patch) || !/^\s*- id:/m.test(patch) || !/^\s*name:/m.test(patch)) {
  fail('cordis.patch.yml does not have the expected insert row shape');
}

const pngFiles = [
  join(repoRoot, 'naiwa-pet', 'icon.png'),
  join(repoRoot, 'naiwa-pet', 'assets', 'naiwa-front.png'),
  join(repoRoot, 'naiwa-pet', 'assets', 'naiwa-front-closed.png'),
  join(repoRoot, 'naiwa-pet', 'assets', 'naiwa-side.png'),
];
for (const file of pngFiles) {
  const bytes = readFileSync(file);
  if (!(bytes[0] === 0x89 && bytes.subarray(1, 4).toString('latin1') === 'PNG')) fail('not a PNG: ' + file);
}

if (failures.length > 0) {
  console.error('[static] FAIL');
  for (const message of failures) console.error('  - ' + message);
  process.exit(1);
}

console.log('[static] PASS');
console.log('  syntax   ' + syntaxCount + ' JS/MJS files');
console.log('  json     ' + jsonFiles.length + ' JSON files');
console.log('  yaml     cordis.patch.yml row shape');
console.log('  png      ' + pngFiles.length + ' sprite/icon files');
