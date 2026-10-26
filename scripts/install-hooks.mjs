/**
 * Point this clone at the committed hooks directory. Idempotent and safe to run
 * outside a git work tree (CI installs, tarball extraction).
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
if (result.status !== 0) {
  console.warn('[hooks] not inside a git work tree; skipping hook installation');
  process.exit(0);
}
console.log('[hooks] core.hooksPath=.githooks');
