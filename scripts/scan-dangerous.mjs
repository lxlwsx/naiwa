/**
 * security-check step 2: reject dangerous primitives in shipped plugin code.
 *
 * v0.2 adds two audited capabilities to the plugin:
 *   - the host half may spawn the desktop Electron shell (fixed argv, shell: false)
 *   - the content table carries fixed product URLs for "open app" (never user input)
 * Both are enumerated as per-file exceptions below, and tests/host-launch keeps
 * verifying that only fixed IDs / fixed argv can reach a spawn call.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pluginDir = join(repoRoot, 'naiwa-pet');

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (['.js', '.cjs', '.mjs'].includes(extname(entry.name))) out.push(full);
  }
  return out;
}

const PLUGIN_FILES = collect(pluginDir).map((file) => relative(repoRoot, file).split(sep).join('/'));

/** capability → files allowed to use it (documented, reviewed exceptions). */
const ALLOW = {
  child_process: new Set(['naiwa-pet/index.js', 'naiwa-pet/desktop/main.cjs']),
  'fixed product url': new Set([
    'naiwa-pet/content.js',
    'naiwa-pet/index.js',
    'naiwa-pet/client.js',
    'naiwa-pet/desktop/main.cjs',
    'naiwa-pet/desktop/pet-app.js',
  ]),
};

const RULES = [
  ['eval', /\beval\s*\(/],
  ['new Function', /new\s+Function\s*\(/],
  ['shell exec', /\b(?:exec|execSync)\s*\(/],
  ['shell: true', /shell\s*:\s*true/],
  ['child_process', /(?:from\s+['"]node:child_process['"]|require\(\s*['"](?:node:)?child_process['"]\s*\))/],
  ['dynamic require', /require\s*\(\s*[^'")]/],
  ['fixed product url', /https?:\/\/(?!localhost\b|127\.0\.0\.1\b)/],
  ['document.write', /document\.write\s*\(/],
  ['innerHTML', /\.innerHTML\s*=/],
  ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
];

const findings = [];
const audited = [];
for (const relativePath of PLUGIN_FILES) {
  const text = readFileSync(join(repoRoot, relativePath), 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
    for (const [name, pattern] of RULES) {
      if (!pattern.test(line)) continue;
      if (ALLOW[name] && ALLOW[name].has(relativePath)) {
        audited.push({ file: relativePath, name });
      } else {
        findings.push({ file: relativePath, line: index + 1, name });
      }
    }
  });
}

if (findings.length > 0) {
  console.error('[dangerous] FAIL — ' + findings.length + ' finding(s)');
  for (const finding of findings) {
    console.error('  ' + finding.file + ':' + finding.line + '  [' + finding.name + ']');
  }
  process.exit(1);
}

console.log(
  '[dangerous] PASS — ' + PLUGIN_FILES.length + ' shipped files, ' + audited.length + ' audited exception(s)',
);
for (const entry of audited.slice(0, 8)) console.log('  audited  ' + entry.file + ' [' + entry.name + ']');
if (audited.length > 8) console.log('  ... ' + (audited.length - 8) + ' more audited lines');
