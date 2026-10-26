import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS,
  ACTION_ORDER,
  BUBBLE_TEXT,
  BUILTIN_APPS,
  CLICK_BUBBLES,
  EXPRESSIONS,
  IDLE_BUBBLES,
  MENU,
  POSITION_MODES,
  labelOf,
  randomActionId,
} from '../naiwa-pet/content.js';

test('actions are consistent and the random order only lists real actions', () => {
  assert.ok(Object.keys(ACTIONS).length >= 5);
  for (const id of ACTION_ORDER) assert.ok(ACTIONS[id], 'ACTION_ORDER has an unknown id: ' + id);
  for (const action of Object.values(ACTIONS)) {
    assert.equal(typeof action.label.zh, 'string');
    assert.equal(typeof action.label.en, 'string');
    assert.equal(typeof action.duration, 'number');
    if (action.id === 'idle') continue;
    assert.ok(ACTION_ORDER.includes(action.id), 'action missing from ACTION_ORDER: ' + action.id);
  }
});

test('randomActionId is deterministic for a fixed roll and always in range', () => {
  assert.equal(
    randomActionId(() => 0),
    ACTION_ORDER[0],
  );
  assert.equal(
    randomActionId(() => 0.999),
    ACTION_ORDER[ACTION_ORDER.length - 1],
  );
  for (const roll of [0, 0.2, 0.5, 0.8, 1]) {
    assert.ok(ACTION_ORDER.includes(randomActionId(() => roll)));
  }
});

test('expressions expose a face hint and an overlay effect', () => {
  const expected = ['tsundere', 'shy', 'enjoy', 'blush', 'cute'];
  assert.deepEqual(Object.keys(EXPRESSIONS), expected);
  for (const expression of Object.values(EXPRESSIONS)) {
    assert.ok(['front', 'front-closed'].includes(expression.face));
    assert.equal(typeof expression.duration, 'number');
    assert.ok(expression.duration >= 1200);
    assert.equal(typeof expression.label.zh, 'string');
  }
});

test('menu groups cover every v0.2 entry point in order', () => {
  assert.deepEqual(
    MENU.map((group) => group.kind),
    ['actions', 'outfits', 'expressions', 'apps', 'position', 'settings', 'quit'],
  );
  for (const group of MENU) {
    assert.equal(typeof group.label.zh, 'string');
    assert.equal(typeof group.label.en, 'string');
  }
});

test('position modes are exactly the four documented states', () => {
  assert.deepEqual(
    POSITION_MODES.map((mode) => mode.id),
    ['app', 'desktop', 'both', 'none'],
  );
});

test('built-in apps are fixed ids and fixed http(s) targets', () => {
  assert.ok(BUILTIN_APPS.length >= 1);
  const ids = new Set();
  for (const app of BUILTIN_APPS) {
    assert.match(app.id, /^[a-z0-9][a-z0-9-]{0,31}$/);
    assert.ok(!ids.has(app.id), 'duplicate builtin app id: ' + app.id);
    ids.add(app.id);
    assert.ok(['url', 'self'].includes(app.type) || typeof app.target === 'string');
    if (app.type === 'url') assert.match(app.target, /^https?:\/\//);
  }
});

test('every bubble key resolves to both languages', () => {
  const keys = new Set([
    ...IDLE_BUBBLES,
    ...CLICK_BUBBLES,
    ...Object.values(ACTIONS)
      .map((action) => action.bubble)
      .filter(Boolean),
    ...Object.values(EXPRESSIONS)
      .map((expression) => expression.bubble)
      .filter(Boolean),
  ]);
  for (const key of keys) {
    assert.ok(BUBBLE_TEXT[key], 'missing bubble text for ' + key);
    assert.ok(BUBBLE_TEXT[key].zh.trim().length > 0, key + ' has no zh text');
    assert.ok(BUBBLE_TEXT[key].en.trim().length > 0, key + ' has no en text');
  }
});

test('labelOf handles localized objects, plain strings and missing labels', () => {
  assert.equal(labelOf({ zh: '汉服·春', en: 'Hanfu · Spring' }, 'zh'), '汉服·春');
  assert.equal(labelOf({ zh: '汉服·春', en: 'Hanfu · Spring' }, 'en'), 'Hanfu · Spring');
  assert.equal(labelOf('done', 'zh'), 'done');
  assert.equal(labelOf(undefined, 'zh'), '');
});
