import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatHostsLine, parseDohAnswers } from '../scripts/check-github-dns.mjs';

test('parseDohAnswers keeps IPv4 A records only, de-duplicated', () => {
  const records = parseDohAnswers({
    Answer: [
      { type: 5, data: 'example.github.com.' },
      { type: 1, data: '20.205.243.166' },
      { type: 1, data: '20.205.243.166' },
      { type: 1, data: '140.82.112.4' },
      { type: 1, data: 'not-an-ip' },
      { type: 28, data: '2606:50c0:8000::153' },
    ],
  });
  assert.deepEqual(records, ['20.205.243.166', '140.82.112.4']);
});

test('parseDohAnswers tolerates missing or malformed payloads', () => {
  assert.deepEqual(parseDohAnswers(null), []);
  assert.deepEqual(parseDohAnswers({}), []);
  assert.deepEqual(parseDohAnswers({ Answer: 'nope' }), []);
  assert.deepEqual(parseDohAnswers({ Answer: [{ type: 1 }] }), []);
});

test('formatHostsLine produces a single hosts entry', () => {
  assert.equal(formatHostsLine('20.205.243.166'), '20.205.243.166 github.com');
});
