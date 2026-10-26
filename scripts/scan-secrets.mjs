/**
 * security-check step 1: scan tracked/working files (or an explicit staged list)
 * for credential material. Implemented locally so the gate works offline and
 * inside the DSH sandbox; no gitleaks binary is required.
 *
 * Usage:
 *   node scripts/scan-secrets.mjs                 # walk the work tree
 *   node scripts/scan-secrets.mjs --staged <file> # scan paths listed in <file>
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.temp', 'debug', '__pycache__']);
const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.ico',
  '.zip',
  '.gz',
  '.ttf',
  '.woff',
  '.woff2',
  '.webm',
  '.mp4',
  '.pdf',
]);

const PATTERNS = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['slack-token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['openai-style-key', /\bsk-[A-Za-z0-9]{20,}\b/],
  ['google-api-key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ['bearer-token', /authorization["'\s:]+bearer\s+[A-Za-z0-9._~+/=-]{20,}/i],
  ['secret-assignment', /(?:api[_-]?key|secret|token|passwd|password|access[_-]?key)\s*[:=]\s*["'][^"'\s]{12,}["']/i],
  ['connection-string', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:@/]+:[^\s@/]+@/i],
];

const ALLOWLIST = /(process\.env|example|placeholder|dummy|redacted|<[^>]+>|\$\{)/i;

function collectFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...collectFiles(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function toRelative(path) {
  return relative(repoRoot, path).split(sep).join('/');
}

const stagedIndex = process.argv.indexOf('--staged');
let files;
if (stagedIndex !== -1) {
  const listPath = process.argv[stagedIndex + 1];
  if (!listPath) {
    console.error('[secrets] --staged requires a file containing the staged path list');
    process.exit(2);
  }
  files = readFileSync(resolve(repoRoot, listPath), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => join(repoRoot, line));
} else {
  files = collectFiles(repoRoot);
}

const findings = [];
for (const file of files) {
  let info;
  try {
    info = statSync(file);
  } catch {
    continue;
  }
  if (!info.isFile() || info.size > 2 * 1024 * 1024) continue;
  const extension = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (BINARY_EXTENSIONS.has(extension)) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  text.split(/\r?\n/).forEach((line, index) => {
    if (ALLOWLIST.test(line)) return;
    for (const [name, pattern] of PATTERNS) {
      if (pattern.test(line)) findings.push({ file: toRelative(file), line: index + 1, name });
    }
  });
}

if (findings.length > 0) {
  console.error('[secrets] FAIL — ' + findings.length + ' potential secret(s)');
  for (const finding of findings) {
    console.error('  ' + finding.file + ':' + finding.line + '  [' + finding.name + ']');
  }
  process.exit(1);
}

console.log('[secrets] PASS — scanned ' + files.length + ' file(s), no credential material found');
