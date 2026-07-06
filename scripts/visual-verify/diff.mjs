import { readFileSync, writeFileSync } from "node:fs";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

export function readPng(path) {
  return PNG.sync.read(readFileSync(path));
}

export function writePng(path, png) {
  writeFileSync(path, PNG.sync.write(png));
}

export function diffImages({ baselinePath, actualPath, diffPath, threshold }) {
  const baseline = readPng(baselinePath);
  const actual = readPng(actualPath);
  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    throw new Error(`diff 이미지 크기 불일치: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`);
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height });
  const mismatch = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    { threshold }
  );
  writePng(diffPath, diff);

  const total = baseline.width * baseline.height;
  const mismatchRatio = total === 0 ? 0 : mismatch / total;
  return {
    width: baseline.width,
    height: baseline.height,
    total,
    mismatch,
    mismatchRatio,
    confidence: 1 - mismatchRatio,
    baseline,
    actual
  };
}

export function countRegionMismatch({ baseline, actual, bbox, threshold }) {
  const [x, y, w, h] = bbox.map((v) => Math.round(v));
  const left = clamp(x, 0, baseline.width);
  const top = clamp(y, 0, baseline.height);
  const right = clamp(x + w, 0, baseline.width);
  const bottom = clamp(y + h, 0, baseline.height);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const total = width * height;
  if (!total) return { total: 0, mismatch: 0, mismatchRatio: 0, confidence: 1 };

  const baseCrop = new Uint8Array(total * 4);
  const actualCrop = new Uint8Array(total * 4);
  let offset = 0;
  for (let row = top; row < bottom; row++) {
    const start = (row * baseline.width + left) * 4;
    const end = start + width * 4;
    baseCrop.set(baseline.data.subarray(start, end), offset);
    actualCrop.set(actual.data.subarray(start, end), offset);
    offset += width * 4;
  }

  const mismatch = pixelmatch(baseCrop, actualCrop, null, width, height, { threshold });
  const mismatchRatio = mismatch / total;
  return { total, mismatch, mismatchRatio, confidence: 1 - mismatchRatio };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
