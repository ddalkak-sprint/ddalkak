// 딸깍 verify-observe — 관찰 기반 검증 오케스트레이터.
//
// 생성 코드를 실제로 렌더해 Figma 노드↔DOM 대응을 "관찰"(텍스트 내용·자산·기하)로 유도하고,
// 짝지어진 쌍만 엄격하게 채점한다. data-dk 앵커에 의존하지 않는다 — 앵커는 생성자(LLM)가
// 부착하므로 실패가 오류와 상관되고(요소를 누락하면 앵커도 같이 사라진다), 정합성을 독립
// 검증할 방법이 없다. 대응의 신뢰는 선언이 아니라 측정에서 얻는다.
//
// 사용법: node scripts/verify-observe/cli.mjs --project sandbox --name pc-home \
//           [--url http://localhost:5173/#pc-home] [--annotate] [--tol 3] [--tol-minor 6]
// 전제: 대상 dev 서버가 떠 있어야 한다 (빌드·렌더 실패는 시끄러운 실패 — 이 도구의 범위 밖).
//
// 원칙 (2026-07-09 pc-home 실측에서 확립):
//  - 매칭은 느슨하게(위치는 동점 해소용), 판정은 엄격하게 — 분리하지 않으면 큰 위치 버그가 "누락"으로 오진
//  - 절대좌표는 채점하지 않는다 — 관계(형제 간격·부모 내 오프셋)만. 연쇄 오탐 방지
//  - 컨테이너는 매칭하지 않고 리프 집합에서 유도한다. 래퍼 사슬 모호성은 기대 bbox와의 IoU로 해소
//  - 부모·자식이 같은 요소로 유도되면(래퍼 병합) 그 쌍의 기하 채점은 건너뛴다 — 병합은 정상 재량
//  - 배경은 유효 배경(조상 투과)으로 판정한다
//  - 조용한 누락 금지 — 채점하지 못한 범위(단서 없는 리프, 미유도 컨테이너)를 리포트에 명시
//  - 주장 범위는 "bridge 스펙 일치". bbox가 스크린샷과 모순인 사례가 있으므로 "Figma 일치"는 별도 층
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveRunConfig } from "./config.mjs";
import { flattenBridge } from "./bridge.mjs";
import { observePage } from "./observe.mjs";
import { matchLeaves, deriveContainers, buildUnits } from "./match.mjs";
import { judge } from "./judge.mjs";
import { buildReport, renderMarkdown } from "./report.mjs";
import { writeAnnotated } from "./annotate.mjs";

export async function runObserveVerify(args) {
  const cfg = resolveRunConfig(args);
  const { leaves, containers } = flattenBridge(cfg.bridge, cfg.screen);
  const { elements, screenshot } = await observePage(cfg);

  const { matched, missing, unmatchable, stats } = matchLeaves(leaves, elements);
  const derived = deriveContainers(containers, leaves, matched, elements);
  const units = buildUnits(leaves, matched, derived);
  const findings = judge({ leaves, containers, matched, missing, derived, units, tol: cfg.tol, tolMinor: cfg.tolMinor });

  const report = buildReport({
    name: cfg.name, screen: cfg.screen, url: cfg.url, viewport: cfg.viewport,
    leaves, matched, missing, unmatchable, matchStats: stats,
    containers, derived, findings, tol: cfg.tol, tolMinor: cfg.tolMinor,
  });

  mkdirSync(cfg.outputDir, { recursive: true });
  const jsonPath = join(cfg.outputDir, `${cfg.name}.observe.json`);
  const mdPath = join(cfg.outputDir, `${cfg.name}.observe.md`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(mdPath, renderMarkdown(report));
  const artifacts = { report: jsonPath, markdown: mdPath };

  if (cfg.annotate) {
    const pngPath = join(cfg.outputDir, `${cfg.name}.observe.png`);
    const wrote = await writeAnnotated({ screenshot, findings, viewport: cfg.viewport, outPath: pngPath });
    if (wrote) artifacts.annotated = pngPath;
  }

  return { report, artifacts };
}

export function exitCodeForResult(report) {
  return report.summary.verdict === "fail" ? 1 : 0;
}
