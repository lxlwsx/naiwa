/**
 * "build" gate: validate the deliverable package without spawning a packer.
 *
 * Checks the bundle manifest, the declared file set, the patch row, the locale
 * metadata, the icon, the sprite frames and the v0.2 outfit/desktop layout.
 * A local directory install links the checkout, so this check operates on real files.
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

function pngSize(path) {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
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

// ---- 基础帧 ----
const host = readFileSync(join(pluginDir, 'index.js'), 'utf8');
const hostPrefix = host.match(/const ROUTE_PREFIX = '([^']+)'/)?.[1];
if (!hostPrefix) fail('host half does not declare ROUTE_PREFIX');
const client = readFileSync(join(pluginDir, 'client.js'), 'utf8');
if (!client.includes("const ROUTE = '" + hostPrefix + "'")) fail('client route prefix does not match the host route');
if (!client.includes('window.__ModuleLoader__.load(')) fail('client.js is not a loader bundle');
const baseFrames = ['naiwa-front.png', 'naiwa-front-closed.png', 'naiwa-side.png'];
for (const file of baseFrames) {
  const path = join(pluginDir, 'assets', file);
  if (!existsSync(path)) {
    fail('missing base frame: ' + file);
    continue;
  }
  const size = pngSize(path);
  if (size.width !== 640 || size.height !== 768) fail('base frame must stay 640x768: ' + file);
}

// ---- 换装 ----
const outfitsDir = join(pluginDir, 'assets', 'outfits');
const outfitIndexPath = join(outfitsDir, 'index.json');
if (!existsSync(outfitIndexPath)) {
  fail('missing assets/outfits/index.json');
} else {
  const index = readJson(outfitIndexPath);
  if (!Array.isArray(index.outfits) || index.outfits.length === 0) fail('outfits index has no outfits');
  const ids = new Set();
  for (const outfit of index.outfits ?? []) {
    if (!outfit || typeof outfit.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(outfit.id)) {
      fail('invalid outfit id: ' + JSON.stringify(outfit));
      continue;
    }
    if (ids.has(outfit.id)) fail('duplicate outfit id: ' + outfit.id);
    ids.add(outfit.id);
    if (outfit.dir === null || outfit.dir === undefined) continue;
    const dir = join(outfitsDir, outfit.dir);
    if (!existsSync(dir)) {
      fail('outfit dir is missing: ' + outfit.dir);
      continue;
    }
    if (!existsSync(join(dir, 'meta.json'))) fail('outfit meta is missing: ' + outfit.dir + '/meta.json');
    else {
      const meta = readJson(join(dir, 'meta.json'));
      if (!meta.name || !meta.season || !Array.isArray(meta.frames))
        fail('outfit meta is missing name/season/frames: ' + outfit.dir);
    }
    for (const frame of ['front.png', 'front-closed.png', 'side.png']) {
      const path = join(dir, frame);
      if (existsSync(path)) {
        const size = pngSize(path);
        if (size.width !== 640 || size.height !== 768)
          fail('outfit frame must be 640x768: ' + outfit.dir + '/' + frame);
      }
    }
  }
  if (!index.outfits.some((outfit) => outfit.id === index.default)) fail('outfits index default is not in the list');
}

// ---- 桌面壳 ----
const desktopDir = join(pluginDir, 'desktop');
for (const file of ['main.cjs', 'preload.cjs', 'pet.html', 'pet-app.js', 'window-physics.cjs']) {
  if (!existsSync(join(desktopDir, file))) fail('missing desktop file: ' + file);
}
if (existsSync(join(desktopDir, 'pet.html'))) {
  const html = readFileSync(join(desktopDir, 'pet.html'), 'utf8');
  if (!html.includes('pet-app.js')) fail('desktop/pet.html must load pet-app.js');
  if (!html.includes('pet-root')) fail('desktop/pet.html must provide #pet-root');
}
const generated = [
  ['client.js', client],
  [
    'desktop/pet-app.js',
    existsSync(join(desktopDir, 'pet-app.js')) ? readFileSync(join(desktopDir, 'pet-app.js'), 'utf8') : '',
  ],
];
for (const [name, source] of generated) {
  if (!source) continue;
  if (/^\s*(import|export)\s/m.test(source)) fail(name + ' must be a classic script (no ESM syntax)');
  if (!source.includes('createPet(')) fail(name + ' does not embed the shared pet core');
}

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
console.log('  sprites      ' + baseFrames.join(', '));
console.log('  outfits      ' + (existsSync(outfitIndexPath) ? readJson(outfitIndexPath).outfits.length : 0));
console.log('  desktop      ' + listFiles(desktopDir).length + ' files');
console.log('  route        ' + hostPrefix);
