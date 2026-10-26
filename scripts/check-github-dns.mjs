/**
 * Diagnose the `github.com` DNS problem that breaks `git push` on this machine.
 *
 * The shell resolver can fail for github.com while browsers still work through a
 * system proxy. This tool resolves the current A records over DNS-over-HTTPS
 * (which uses ordinary HTTPS, so it survives the broken plain-DNS path), reports
 * them, and prints the exact hosts-file line to add.
 *
 * Usage:
 *   node scripts/check-github-dns.mjs            # resolve and print the suggestion
 *   node scripts/check-github-dns.mjs --apply    # append the hosts entry (needs admin)
 *
 * Nothing is written unless --apply is passed, and the hosts file is only touched
 * when the process is elevated.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const HOST = 'github.com';
const DOH_ENDPOINTS = [
  'https://dns.alidns.com/resolve?name=' + HOST + '&type=A',
  'https://doh.pub/dns-query?name=' + HOST + '&type=A',
  'https://dns.google/resolve?name=' + HOST + '&type=A',
];

export function parseDohAnswers(payload) {
  if (!payload || !Array.isArray(payload.Answer)) return [];
  const seen = new Set();
  const records = [];
  for (const answer of payload.Answer) {
    if (answer.type !== 1 || typeof answer.data !== 'string') continue;
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(answer.data)) continue;
    if (seen.has(answer.data)) continue;
    seen.add(answer.data);
    records.push(answer.data);
  }
  return records;
}

export function formatHostsLine(ip) {
  return ip + ' ' + HOST;
}

export function isElevated() {
  if (process.platform !== 'win32') return process.getuid?.() === 0;
  try {
    const command =
      '(New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()))' +
      '.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)';
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', command], { encoding: 'utf8' }).trim() === 'True';
  } catch {
    return false;
  }
}

async function resolveOverDoh() {
  const failures = [];
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, { headers: { accept: 'application/dns-json' } });
      if (!response.ok) {
        failures.push(endpoint + ' -> ' + response.status);
        continue;
      }
      const records = parseDohAnswers(await response.json());
      if (records.length > 0) return { records, endpoint };
      failures.push(endpoint + ' -> no A records');
    } catch (error) {
      failures.push(endpoint + ' -> ' + error.message);
    }
  }
  throw new Error('all DoH endpoints failed:\n  ' + failures.join('\n  '));
}

function hostsPath() {
  if (process.platform === 'win32') return 'C:\\Windows\\System32\\drivers\\etc\\hosts';
  return '/etc/hosts';
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { records, endpoint } = await resolveOverDoh();
  console.log('[dns] ' + HOST + ' A records: ' + records.join(', ') + '  (via ' + endpoint + ')');

  const line = formatHostsLine(records[0]);
  console.log('[dns] suggested hosts entry: ' + line);

  try {
    const { lookup } = await import('node:dns/promises');
    const addresses = await lookup(HOST, { all: true });
    console.log('[dns] system resolver says: ' + addresses.map((entry) => entry.address).join(', '));
  } catch (error) {
    console.log('[dns] system resolver failed: ' + error.message);
  }

  const path = hostsPath();
  if (!apply) {
    console.log('[dns] not modified. Add this line to ' + path + ' (administrator), then retry git push:');
    console.log('      ' + line);
    return;
  }
  if (!isElevated()) {
    console.log('[dns] --apply needs an elevated shell; re-run as administrator. No change made.');
    process.exitCode = 1;
    return;
  }
  const existing = readFileSync(path, 'utf8');
  if (existing.split(/\r?\n/).some((row) => /^\s*\d/.test(row) && row.trim().endsWith(HOST))) {
    console.log('[dns] hosts file already maps ' + HOST + '; nothing to do');
    return;
  }
  appendFileSync(path, '\n# added by dsh-naiwa-pet scripts/check-github-dns.mjs\n' + line + '\n');
  console.log('[dns] appended to ' + path);
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error('[dns] FAIL ' + error.message);
    process.exit(1);
  });
}
