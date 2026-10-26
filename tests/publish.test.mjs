import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertBranchName, parseCommitMeta, parseDiff, parseTree } from '../scripts/publish-github.mjs';

const NUL = '\u0000';

test('parseTree reads every ls-tree record', () => {
  const buffer = Buffer.from(
    '100644 blob aaa111\tAGENTS.md' + NUL + '100755 blob bbb222\tscripts/run.sh' + NUL,
    'utf8',
  );
  const entries = parseTree(buffer);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { mode: '100644', type: 'blob', sha: 'aaa111', path: 'AGENTS.md' });
  assert.deepEqual(entries[1], { mode: '100755', type: 'blob', sha: 'bbb222', path: 'scripts/run.sh' });
});

test('parseDiff maps add/modify/delete records', () => {
  const changes = parseDiff(
    Buffer.from('A' + NUL + 'a.txt' + NUL + 'M' + NUL + 'b.txt' + NUL + 'D' + NUL + 'c.txt' + NUL, 'utf8'),
  );
  assert.deepEqual(changes, [
    { status: 'A', path: 'a.txt' },
    { status: 'M', path: 'b.txt' },
    { status: 'D', path: 'c.txt' },
  ]);
});

test('parseDiff rejects rename records instead of mis-pairing paths', () => {
  assert.throws(
    () => parseDiff(Buffer.from('R100' + NUL + 'old.txt' + NUL + 'new.txt' + NUL, 'utf8')),
    /unsupported diff status/,
  );
});

test('parseCommitMeta keeps author, committer and multi-line message', () => {
  const raw = [
    'Lin',
    'lin@example.com',
    '2026-10-26T17:00:00+08:00',
    'Lin',
    'lin@example.com',
    '2026-10-26T17:01:00+08:00',
    'feat(scope): subject',
    '',
    'body line',
  ].join('\n');
  const meta = parseCommitMeta(raw);
  assert.equal(meta.author.name, 'Lin');
  assert.equal(meta.committer.date, '2026-10-26T17:01:00+08:00');
  assert.equal(meta.message, 'feat(scope): subject\n\nbody line');
});

test('assertBranchName refuses protected branches so main only moves via PR', () => {
  assert.equal(assertBranchName('feat/tooling'), 'feat/tooling');
  assert.equal(assertBranchName('refs/heads/fix/x'), 'fix/x');
  for (const branch of ['main', 'master', 'refs/heads/main', 'refs/heads/master']) {
    assert.throws(() => assertBranchName(branch), /protected branch/);
  }
  for (const branch of ['', '-bad', 'a..b']) {
    assert.throws(() => assertBranchName(branch), /invalid branch name/);
  }
});
