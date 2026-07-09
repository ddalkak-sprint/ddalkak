#!/usr/bin/env node
// 브릿지 JSON 저장 포맷 변환 — 정본은 compact(무들여쓰기), 사람 검토용만 --pretty.
//
// 근거(토큰=시간): pc-home 실측 pretty 94KB(≈24k 토큰) vs compact 23KB(≈6k 토큰) — 4배.
// plan/code/verify가 매 단계 이 파일을 읽으므로 저장 포맷이 곧 파이프라인 시간이다.
//
// 사용:
//   node scripts/bridge-format.mjs <bridge.json>            # compact로 재저장 (정본 포맷)
//   node scripts/bridge-format.mjs <bridge.json> --pretty   # 사람 검토용 들여쓰기 출력(stdout)

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const pretty = args.includes("--pretty");
const target = args.find((a) => a !== "--pretty");

if (!target) {
  console.error("사용법: node scripts/bridge-format.mjs <bridge.json> [--pretty]");
  process.exit(1);
}

const data = JSON.parse(readFileSync(target, "utf8"));
if (pretty) {
  console.log(JSON.stringify(data, null, 2));
} else {
  const before = readFileSync(target, "utf8").length;
  const compact = JSON.stringify(data);
  writeFileSync(target, compact + "\n");
  console.log(`compact 저장: ${target}  ${before} → ${compact.length} bytes (~${Math.round(compact.length / 4 / 1000)}k 토큰)`);
}
