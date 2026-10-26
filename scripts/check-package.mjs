/**
 * "build" gate: validate the deliverable package without spawning a packer.
 *
 * Checks the bundle manifest, the declared file set, the patch row, the locale
 * metadata, the icon and every sprite referenced by the client half. A local
 * directory install links the checkout, so this check operates on real files.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(repoRoot, 'naiwa-pet');
const failures = [];
const fail = (message) => failures.push(message);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

function matchGlob(pattern, file) {
  const patternSegments = pattern.split('/');
  const fileSegments = file.split('/');
  const segmentMatches = (segment, value) => {
    if (!segment.includes('*')) return segment === value;
    const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp('^' + escaped + '$').test(value);
  };
  const walk = (pi, fi) => {
    if (pi === patternSegments.length) return fi === fileSegments.length;
    const segment = patternSegments[pi];
    if (segment === '**') {
      for (let skip = fi; skip <= fileSegments.length; skip += 1) {
        if (walk(pi + 1, skip)) return true;
      }
      return false;
    }
    if (fi >= fileSegments.length) return false;
    return segmentMatches(segment, fileSegments[fi]) && walk(pi + 1, fi + 1);
  };
  return walk(0, 0);
}

const pkg = readJson(join(pluginDir, 'package.json'));
for (const field of ['name', 'version', 'type', 'exports', 'files', 'dsh']) {
  if (pkg[field] === undefined) fail('package.json is missing "' + field + '"');
}
if (pkg.name !== 'dsh-naiwa-pet') fail('unexpected package name: ' + pkg.name);
if (pkg.dsh?.bundle?.patch !== './cordis.patch.yml') fail('dsh.bundle.patch must point at ./cordis.patch.yml');
if (pkg.dsh?.client?.platform !== 'web') fail('dsh.client.platform must be "web"');

for (const [subpath, target] of Object.entries(pkg.exports ?? {})) {
  if (!target.startsWith('./')) {
    fail('exports["' + subpath + '"] must stay inside the package');
    continue;
  }
  if (!target.includes('*') && !existsSync(join(pluginDir, target))) fail('exports target is missing: ' + target);
}

const files = pkg.files ?? [];
if (!Array.isArray(files) || files.length === 0) fail('package.json "files" must be a non-empty array');
const runtime = listFiles(pluginDir)
  .map((path) => relative(pluginDir, path).split(sep).join('/'))
  .filter((file) => file !== 'package.json');
const uncovered = runtime.filter((file) => !files.some((pattern) => matchGlob(pattern, file)));
if (uncovered.length > 0) fail('files list misses: ' + uncovered.join(', '));

const patch = readFileSync(join(pluginDir, 'cordis.patch.yml'), 'utf8');
if (!/^- insert:/m.test(patch)) fail('cordis.patch.yml must insert a row');
if (!new RegExp('^\\s*-\\s*id:\\s*' + pkg.name + '\\s*$', 'm').test(patch))
  fail('patch row id must equal the package name');
if (!patch.includes("name: '" + pkg.name + "'")) fail('patch row name must equal the package name');

for (const locale of ['zh', 'en']) {
  const dict = readJson(join(pluginDir, 'locale', locale + '.json'));
  if (!dict.meta?.title || !dict.meta?.description)
    fail('locale/' + locale + '.json lacks meta.title or meta.description');
}

if (!existsSync(join(pluginDir, pkg.icon ?? ''))) fail('declared icon is missing: ' + pkg.icon);

const client = readFileSync(join(pluginDir, 'client.js'), 'utf8');
const host = readFileSync(join(pluginDir, 'index.js'), 'utf8');
const referenced = [...client.matchAll(/ASSET_BASE \+ '([^']+\.png)'/g)].map((match) => match[1]);
const hostPrefix = host.match(/const ROUTE_PREFIX = '([^']+)'/)?.[1];
if (!hostPrefix) fail('host half does not declare ROUTE_PREFIX');
if (!client.includes("const ASSET_BASE = '" + hostPrefix + "/assets/'"))
  fail('client asset base does not match the host route');
for (const file of referenced) {
  if (!existsSync(join(pluginDir, 'assets', file))) fail('client references a missing sprite: ' + file);
}
if (referenced.length === 0) fail('client half references no sprite frames');

for (const forbidden of ['node_modules', '.temp', 'debug', '__pycache__']) {
  if (existsSync(join(pluginDir, forbidden))) fail('plugin directory must not ship ' + forbidden + '/');
}

if (failures.length > 0) {
  console.error('[build] FAIL');
  for (const message of failures) console.error('  - ' + message);
  process.exit(1);
}

console.log('[build] PASS');
console.log('  package      ' + pkg.name + '@' + pkg.version);
console.log('  runtime files ' + runtime.length + ' covered by ' + files.length + ' files patterns');
console.log('  sprites      ' + referenced.join(', '));
console.log('  route        ' + hostPrefix);
