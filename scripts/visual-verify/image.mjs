import { copyFileSync } from "node:fs";
import sharp from "sharp";

export class VisualVerifyImageError extends Error {
  constructor(message) {
    super(message);
    this.name = "VisualVerifyImageError";
  }
}

export async function assertExactImageSize(path, expected, label) {
  const metadata = await sharp(path).metadata();
  const actual = { width: metadata.width, height: metadata.height };
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new VisualVerifyImageError(
      `${label} 크기 불일치: expected ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height} (${path})`
    );
  }
  return actual;
}

export async function normalizePng({ source, dest, expected, label }) {
  await assertExactImageSize(source, expected, label);
  await sharp(source).png().toFile(dest);
  await assertExactImageSize(dest, expected, `${label} normalize result`);
}

export function copyArtifact(source, dest) {
  copyFileSync(source, dest);
}
