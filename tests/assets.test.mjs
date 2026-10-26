import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { assetsDir, pngInfo, readJson } from './support.mjs';

const sprite = readJson(join(assetsDir, 'sprite.json'));
const frames = sprite.frames ?? {};
const frameNames = ['front', 'front_closed', 'side'];
const canvasWidth = sprite.canvas?.width;
const canvasHeight = sprite.canvas?.height;
const outfitsDir = join(assetsDir, 'outfits');

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

test('outfit index lists the base outfit and four hanfu seasons', () => {
  const index = readJson(join(outfitsDir, 'index.json'));
  assert.equal(index.default, 'classic');
  const ids = index.outfits.map((outfit) => outfit.id);
  assert.deepEqual(ids, ['classic', 'hanfu-spring', 'hanfu-summer', 'hanfu-autumn', 'hanfu-winter']);
  for (const outfit of index.outfits) {
    assert.ok(outfit.name.zh && outfit.name.en, 'outfit name must be localized: ' + outfit.id);
    if (outfit.id === 'classic') {
      assert.equal(outfit.dir, null, 'the base outfit must reuse the base frames');
      continue;
    }
    assert.equal(outfit.season, outfit.id.replace('hanfu-', ''));
    assert.equal(outfit.dir, outfit.id);
    assert.ok(existsSync(join(outfitsDir, outfit.dir)), 'missing outfit dir: ' + outfit.dir);
    const meta = readJson(join(outfitsDir, outfit.dir, 'meta.json'));
    assert.equal(meta.season, outfit.season);
    assert.ok(meta.name.zh && meta.name.en);
    assert.ok(Array.isArray(meta.frames));
    assert.ok(meta.eye_centers_pct.left && meta.eye_centers_pct.right);
    assert.ok(existsSync(join(outfitsDir, outfit.dir, 'README.md')));
  }
});

test('outfits README keeps the shared canvas contract for future art', () => {
  const readme = readFileSync(join(outfitsDir, 'README.md'), 'utf8');
  for (const token of ['640', '768', '730', '608', 'front.png', 'front-closed.png', 'side.png', 'meta.json']) {
    assert.ok(readme.includes(token), 'outfits README is missing ' + token);
  }
});

test('any outfit art already dropped in keeps the base canvas contract', () => {
  for (const entry of readdirSync(outfitsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const frame of ['front.png', 'front-closed.png', 'side.png']) {
      const path = join(outfitsDir, entry.name, frame);
      if (!existsSync(path)) continue;
      const info = pngInfo(path);
      assert.equal(info.width, 640, path + ' width');
      assert.equal(info.height, 768, path + ' height');
      assert.equal(info.colorType, 6, path + ' must be RGBA');
    }
  }
});
