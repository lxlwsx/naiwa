import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { assetsDir, pngInfo, readJson } from './support.mjs';

const sprite = readJson(join(assetsDir, 'sprite.json'));
const frames = sprite.frames ?? {};
const frameNames = ['front', 'front_closed', 'side'];
const canvasWidth = sprite.canvas?.width;
const canvasHeight = sprite.canvas?.height;

test('sprite contract declares the shared canvas and all frames', () => {
  assert.deepEqual({ width: canvasWidth, height: canvasHeight }, { width: 640, height: 768 });
  for (const name of frameNames) {
    assert.ok(frames[name], 'missing frame: ' + name);
    assert.equal(frames[name].file, 'naiwa-' + name.replace('_', '-') + '.png');
  }
});

test('every frame is a transparent RGBA PNG on the declared canvas', () => {
  for (const name of frameNames) {
    const frame = frames[name];
    const info = pngInfo(join(assetsDir, frame.file));
    assert.equal(info.width, canvasWidth, name + ' width');
    assert.equal(info.height, canvasHeight, name + ' height');
    assert.equal(info.colorType, 6, name + ' must be RGBA with alpha');
    assert.equal(info.bitDepth, 8, name + ' must be 8-bit per channel');
  }
});

test('frames share one scale, feet baseline and horizontal centre', () => {
  const baselines = frameNames.map((name) => frames[name].feet_baseline_y);
  assert.equal(new Set(baselines).size, 1, 'feet baseline differs across frames: ' + baselines.join(', '));
  assert.ok(Math.abs(baselines[0] - sprite.feet_baseline_y) <= 1, 'frame baseline must match sprite baseline');

  const heights = frameNames.map((name) => frames[name].subject_height);
  const spread = Math.max(...heights) - Math.min(...heights);
  assert.ok(spread <= 4, 'subject height must stay within 4px across frames, spread=' + spread);

  for (const name of frameNames) {
    const bbox = frames[name].bbox;
    const centre = bbox.x + bbox.w / 2;
    assert.ok(Math.abs(centre - canvasWidth / 2) <= 2, name + ' is not horizontally centred: ' + centre);
  }
});

test('front and closed frames are pixel-aligned for cross-fade blinking', () => {
  assert.deepEqual(frames.front_closed.bbox, frames.front.bbox);
  assert.equal(frames.front_closed.eyes_closed, true);
  assert.equal(frames.front.eyes_closed, false);
  assert.equal(frames.side.facing, 'left', 'side sprite must face left; the client mirrors it when walking right');
});

test('frames keep the safe margins and stay within the size budget', () => {
  for (const name of frameNames) {
    const frame = frames[name];
    const { bbox } = frame;
    assert.ok(bbox.x >= 8, name + ' left margin too small');
    assert.ok(bbox.y >= 8, name + ' top margin too small');
    assert.ok(bbox.x + bbox.w <= canvasWidth - 8, name + ' right margin too small');
    assert.ok(bbox.y + bbox.h <= canvasHeight - 8, name + ' bottom margin too small');
    assert.ok(frame.bytes <= 400 * 1024, name + ' exceeds the 400 KiB budget: ' + frame.bytes);
  }
});

test('eye anchors are recorded inside the face area', () => {
  for (const name of ['front', 'front_closed']) {
    const frame = frames[name];
    for (const [x, y] of frame.eye_centers_pct) {
      assert.ok(x > 20 && x < 80, name + ' eye x out of face area: ' + x);
      assert.ok(y > 12 && y < 40, name + ' eye y out of face area: ' + y);
    }
    for (const [x, y, w, h] of frame.eye_boxes_px) {
      assert.ok(x >= 0 && y >= 0 && x + w <= canvasWidth && y + h <= canvasHeight, name + ' eye box out of canvas');
    }
  }
  assert.deepEqual(frames.front_closed.eye_centers_pct, frames.front.eye_centers_pct);
});
