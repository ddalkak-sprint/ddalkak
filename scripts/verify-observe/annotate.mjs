// 검출 지점 시각 표기 — 위반 rect를 스크린샷 위에 번호 마커로 합성한다.
// major = 주황 실선, minor = 회색 점선. 번호는 리포트 findings 배열의 1-기준 순번과 대응.
import sharp from "sharp";

const COLOR = { major: "#AE4A2E", minor: "#6B7A88" };
const PAD = 6;

export async function writeAnnotated({ screenshot, findings, viewport, outPath }) {
  const boxes = [];
  findings.forEach((f, idx) => {
    const rect = f.rect ?? (f.rects ? union(f.rects) : null);
    if (rect) boxes.push({ n: idx + 1, rect, color: COLOR[f.severity], dashed: f.severity === "minor" });
  });
  if (!boxes.length) return false;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewport.width}" height="${viewport.height}">`;
  for (const b of boxes) {
    let [x, y, w, h] = b.rect;
    x -= PAD; y -= PAD; w += PAD * 2; h += PAD * 2;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${b.color}" fill-opacity="0.07" stroke="${b.color}" stroke-width="4"${b.dashed ? ' stroke-dasharray="12 8"' : ""}/>`;
    const bx = Math.max(x, 4) + 18;
    const by = y < 24 ? y + 24 : y;
    svg += `<circle cx="${bx}" cy="${by}" r="17" fill="${b.color}"/>`;
    svg += `<text x="${bx}" y="${by + 8}" text-anchor="middle" font-family="Helvetica, Arial" font-size="22" font-weight="bold" fill="#ffffff">${b.n}</text>`;
  }
  svg += `</svg>`;

  await sharp(screenshot).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(outPath);
  return true;
}

function union(rects) {
  const x = Math.min(...rects.map((r) => r[0]));
  const y = Math.min(...rects.map((r) => r[1]));
  return [
    x,
    y,
    Math.max(...rects.map((r) => r[0] + r[2])) - x,
    Math.max(...rects.map((r) => r[1] + r[3])) - y,
  ];
}
