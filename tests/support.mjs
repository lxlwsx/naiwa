/**
 * Shared test helpers: paths, PNG header probing, glob matching.
 * Deliberately dependency-free so the test suite runs on a bare Node runtime.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const pluginDir = join(repoRoot, 'naiwa-pet');
export const assetsDir = join(pluginDir, 'assets');

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Read width/height/colour-type straight out of the PNG IHDR chunk. */
export function pngInfo(path) {
  const bytes = readFileSync(path);
  const signatureOk = bytes.length > 26 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString('latin1') === 'PNG';
  if (!signatureOk) throw new Error('not a PNG file: ' + path);
  return {
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
}

export function listFiles(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out;
}

export function pluginRelative(path) {
  return relative(pluginDir, path).split(sep).join('/');
}

/** Minimal glob: `*` matches within a segment, `**` spans segments. */
export function matchGlob(pattern, file) {
  const patternSegments = pattern.split('/');
  const fileSegments = file.split('/');

  const segmentMatches = (segment, value) => {
    if (!segment.includes('*')) return segment === value;
    const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
    return new RegExp('^' + escaped + '$').test(value);
  };

  const walk = (pi, fi) => {
    if (pi === patternSegments.length) return fi === fileSegments.length;
    const segment = patternSegments[pi];
    if (segment === '**') {
      for (let skip = fi; skip <= fileSegments.length; skip += 1) {
        if (walk(pi + 1, skip)) return true;
      }
      return false;
    }
    if (fi >= fileSegments.length) return false;
    return segmentMatches(segment, fileSegments[fi]) && walk(pi + 1, fi + 1);
  };
  return walk(0, 0);
}
