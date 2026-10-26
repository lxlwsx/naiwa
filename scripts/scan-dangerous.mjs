/**
 * security-check step 2: reject dangerous primitives in the shipped plugin code.
 * The pet bundle is a read-only asset server plus a UI overlay; it has no reason
 * to evaluate strings, spawn processes or reach the network.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_FILES = ['naiwa-pet/index.js', 'naiwa-pet/client.js'];

const RULES = [
  ['eval', /\beval\s*\(/],
  ['new Function', /new\s+Function\s*\(/],
  ['child_process', /(?:from\s+['"]node:child_process['"]|require\(\s*['"]child_process['"]\s*\))/],
  ['dynamic require', /require\s*\(\s*[^'")]/],
  ['external network', /https?:\/\/(?!localhost\b)/],
  ['document.write', /document\.write\s*\(/],
  ['innerHTML', /\.innerHTML\s*=/],
  ['v-html style injection', /dangerouslySetInnerHTML/],
];

const findings = [];
for (const relativePath of PLUGIN_FILES) {
  const file = join(repoRoot, relativePath);
  const text = readFileSync(file, 'utf8');
  text.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//')) return;
    for (const [name, pattern] of RULES) {
      if (pattern.test(line)) findings.push({ file: relativePath, line: index + 1, name });
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

console.log('[dangerous] PASS — ' + PLUGIN_FILES.length + ' shipped files use no dangerous primitives');
