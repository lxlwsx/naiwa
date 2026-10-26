import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createPet,
  parseInterval,
  PET_CSS,
  FRAME_NAMES,
  DEFAULT_FRAME_RATIO,
  frameUrls,
} from '../naiwa-pet/pet-core.js';
import * as content from '../naiwa-pet/content.js';

const BOUNDS = { width: 800, height: 600 };
const SIZE = 100;
const RATIO = 1.2; // stageH = 120, floorY = 600 - 120 - 12 = 468

function makePet(options = {}) {
  let now = 0;
  const events = [];
  const paints = [];
  const pet = createPet({
    content,
    motion: options.motion || 'dom',
    size: SIZE,
    frameRatio: RATIO,
    initial: { x: options.x ?? 40, y: options.y ?? 0 },
    outfitId: options.outfitId || 'classic',
    frames: {},
    bounds: () => BOUNDS,
    now: () => now,
    random: () => 0.5,
    onPaint: (view) => paints.push(view),
    onBubble: (key, ms) => events.push({ type: 'bubble', key, ms }),
    onBurst: (kind) => events.push({ type: 'burst', kind }),
    onEvent: (type, payload) => events.push({ type, payload }),
    onPersist: () => {},
  });
  pet.start();
  const step = (ms) => {
    now += ms;
    pet.tick(now);
  };
  return { pet, step, events, paints, at: () => now, view: () => pet.view(), state: () => pet.state() };
}

function settle(pet, step, limit = 600) {
  for (let index = 0; index < limit && pet.state().mode !== 'idle'; index += 1) step(16);
}

test('parseInterval normalizes numbers, ranges and arrays', () => {
  assert.deepEqual(parseInterval('2800-6400'), [2800, 6400]);
  assert.deepEqual(parseInterval(3000), [3000, 3000]);
  assert.deepEqual(parseInterval([2000, 5000]), [2000, 5000]);
  assert.deepEqual(parseInterval('nope', [2800, 6400]), [2800, 6400]);
  assert.deepEqual(parseInterval('100-50'), [400, 400]);
});

test('shared CSS exposes the three frames and the squash/spin keyframes', () => {
  assert.deepEqual(FRAME_NAMES, ['front', 'front-closed', 'side']);
  assert.ok(DEFAULT_FRAME_RATIO > 1.1 && DEFAULT_FRAME_RATIO < 1.3);
  assert.match(PET_CSS, /\.naiwa-stage/);
  assert.match(PET_CSS, /naiwa-squash/);
  assert.match(PET_CSS, /naiwa-spin/);
  assert.match(PET_CSS, /naiwa-blush/);
});

test('frameUrls switches between the base frames and an outfit directory', () => {
  const base = '/dsh-naiwa-pet-7341/assets/';
  assert.equal(frameUrls(base, { dir: null }, 'front'), base + 'naiwa-front.png');
  assert.equal(frameUrls(base, { dir: 'hanfu-spring' }, 'side'), base + 'outfits/hanfu-spring/side.png');
});

test('falls back to the floor and settles into idle', () => {
  const { pet, step, view } = makePet();
  assert.equal(view().stageH, 120);
  assert.equal(view().floorY, 468);
  step(16);
  settle(pet, step);
  const state = pet.state();
  assert.equal(state.mode, 'idle');
  assert.equal(Math.round(state.y), 468);
  assert.ok(state.x >= 6 && state.x <= 800 - SIZE - 8);
});

test('throw from a drag keeps momentum, bounces off the right wall and settles', () => {
  const { pet, step, events, state } = makePet({ x: 660 });
  pet.pointerDown({ x: 660, y: 468, screenX: 660, screenY: 468, time: 0 });
  pet.pointerMove({ x: 680, y: 468, screenX: 680, screenY: 468, time: 10 });
  pet.pointerUp({ x: 680, y: 468, screenX: 680, screenY: 468, time: 20 });
  assert.equal(state().mode, 'air');
  assert.ok(state().vx > 100, 'release must carry the drag velocity, vx=' + state().vx);
  let bounced = false;
  for (let index = 0; index < 400; index += 1) {
    step(16);
    if (state().vx < 0) bounced = true;
    if (state().mode === 'idle') break;
  }
  assert.ok(bounced, 'the pet must reverse direction after hitting the right wall');
  assert.equal(state().mode, 'idle');
  assert.ok(state().x >= 6 && state().x <= 800 - SIZE - 8, 'the pet must stay on screen, x=' + state().x);
  assert.ok(
    events.some((event) => event.type === 'squash'),
    'wall/floor impact must squash the body',
  );
});

test('a click plays a random action, squints and bursts hearts', () => {
  const { pet, events, view } = makePet({ x: 40, y: 468 });
  pet.pointerDown({ x: 40, y: 468, screenX: 40, screenY: 468, time: 0 });
  pet.pointerUp({ x: 40, y: 468, screenX: 40, screenY: 468, time: 40 });
  const current = view();
  assert.ok(content.ACTION_ORDER.includes(current.action), 'expected a random action, got ' + current.action);
  assert.equal(current.closed, true, 'click must switch to the closed-eye (squint smile) frame');
  assert.ok(events.some((event) => event.type === 'burst' && event.kind === 'hearts'));
  assert.ok(events.some((event) => event.type === 'bubble'));
});

test('a double click spins the pet and keeps the squint frame', () => {
  const { pet, events, view } = makePet({ x: 40, y: 468 });
  pet.pointerDown({ x: 40, y: 468, screenX: 40, screenY: 468, time: 0 });
  pet.pointerUp({ x: 40, y: 468, screenX: 40, screenY: 468, time: 30 });
  pet.pointerDown({ x: 40, y: 468, screenX: 40, screenY: 468, time: 200 });
  pet.pointerUp({ x: 40, y: 468, screenX: 40, screenY: 468, time: 230 });
  assert.ok(
    events.some((event) => event.type === 'spin'),
    'double click must trigger the spin overlay',
  );
  assert.equal(view().closed, true);
});

test('an expression is an overlay that expires without touching the motion mode', () => {
  const { pet, view, step } = makePet({ x: 40, y: 468 });
  pet.setExpression('blush');
  assert.equal(view().expression, 'blush');
  assert.equal(view().expressionEffect, 'blush');
  step(3000);
  assert.equal(view().expression, '');
  assert.equal(view().mode, 'idle');
});

test('idle blinking closes the eyes periodically', () => {
  const { pet, step, paints } = makePet({ x: 40, y: 468 });
  let sawClosed = false;
  for (let index = 0; index < 120 && !sawClosed; index += 1) {
    step(100);
    sawClosed = paints.some((paint) => paint.face === 'closed');
  }
  assert.ok(sawClosed, 'idle pet must blink at least once in 12 seconds');
  pet.stop();
});

test('setSize, setOutfit and setFrames flow into the painted view', () => {
  const { pet, view } = makePet({ x: 40, y: 468 });
  pet.setSize(200);
  pet.setOutfit('hanfu-spring');
  pet.setFrames({ front: '/a.png', side: '/b.png', 'front-closed': '/c.png' });
  pet.paint();
  const current = view();
  assert.equal(current.size, 200);
  assert.equal(current.outfitId, 'hanfu-spring');
  assert.equal(current.frames.front, '/a.png');
  assert.equal(current.stageH, 240);
});

test('external motion mode reports drag deltas without moving the pet itself', () => {
  const { pet, events, state } = makePet({ motion: 'external', x: 0, y: 0 });
  const startX = state().x;
  pet.pointerDown({ x: 20, y: 20, screenX: 500, screenY: 500, time: 0 });
  pet.pointerMove({ x: 20, y: 20, screenX: 540, screenY: 512, time: 20 });
  pet.pointerUp({ x: 20, y: 20, screenX: 540, screenY: 512, time: 40 });
  assert.equal(state().x, startX, 'external mode must never integrate DOM coordinates');
  const deltas = events.filter((event) => event.type === 'dragdelta');
  assert.equal(deltas.length, 1);
  assert.deepEqual(deltas[0].payload, { dx: 40, dy: 12 });
  assert.ok(events.some((event) => event.type === 'dragend'));
  pet.externalMotion({ mode: 'walk', dir: -1 });
  assert.equal(state().mode, 'walk');
  assert.equal(state().dir, -1);
  pet.externalMotion({ mode: 'idle', squash: true });
  assert.equal(state().mode, 'idle');
  assert.ok(events.some((event) => event.type === 'squash'));
});
