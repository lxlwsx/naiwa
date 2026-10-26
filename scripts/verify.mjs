/**
 * Full verification gate: build -> test -> lint -> format -> static -> security.
 *
 * Child processes inherit stdio on purpose: the DSH sandbox denies piped child
 * stdio, so output is streamed straight to the terminal and only exit codes are
 * inspected. `--pre-commit` skips the (already fast) build step.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(repoRoot);

const preCommit = process.argv.includes('--pre-commit');
const tests = [
  'tests/manifest.test.mjs',
  'tests/assets.test.mjs',
  'tests/host-route.test.mjs',
  'tests/client-contract.test.mjs',
  'tests/publish.test.mjs',
  'tests/dns.test.mjs',
];

const steps = [];
if (!preCommit) steps.push({ name: 'build', args: ['scripts/check-package.mjs'] });
steps.push({ name: 'test', args: ['--test', '--test-isolation=none', ...tests] });
steps.push({ name: 'lint', args: ['node_modules/eslint/bin/eslint.js', '.'] });
steps.push({ name: 'format', args: ['node_modules/prettier/bin/prettier.cjs', '--check', '.'] });
steps.push({ name: 'static', args: ['scripts/check-static.mjs'] });
steps.push({ name: 'security/secrets', args: ['scripts/scan-secrets.mjs'] });
steps.push({ name: 'security/dangerous', args: ['scripts/scan-dangerous.mjs'] });

for (const step of steps) {
  process.stdout.write('\n=== ' + step.name + ' ===\n');
  const result = spawnSync(process.execPath, step.args, { stdio: 'inherit' });
  if (result.error) {
    console.error('[verify] FAIL ' + step.name + ': ' + result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error('\n[verify] FAIL at "' + step.name + '" (exit ' + result.status + ')');
    process.exit(1);
  }
}

console.log('\n[verify] PASS — ' + steps.map((step) => step.name).join(' -> '));
