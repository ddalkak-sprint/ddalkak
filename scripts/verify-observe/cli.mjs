#!/usr/bin/env node
import { parseArgs, ObserveVerifyConfigError } from "./config.mjs";
import { runObserveVerify, exitCodeForResult } from "./index.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { report, artifacts } = await runObserveVerify(args);
  const s = report.summary;
  const icon = { pass: "✅", conditional: "⚠️", fail: "❌" }[s.verdict];

  console.log(`${icon} verify-observe ${s.verdict}: ${report.name}/${report.screen} — 매칭 ${s.matched}/${s.leaves} (누락 ${s.missing}) · major ${s.major} · minor ${s.minor}`);
  console.log(`매칭 방법: ${Object.entries(s.matching).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} · 유도 ${Object.entries(s.derivation).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} · 미유도 ${report.coverage.underivedContainers.length}`);
  for (const f of report.findings.filter((x) => x.severity === "major")) {
    console.log(` - [${f.kind}] ${f.path} ${f.where} — 기대 ${f.expected} / 실측 ${f.actual}${f.src ? ` @ ${f.src}` : ""}`);
  }
  const minors = report.findings.filter((x) => x.severity === "minor");
  if (minors.length) console.log(` - minor ${minors.length}건 (렌더링 노이즈 가능성) — 상세는 리포트 참조`);
  console.log(`리포트: ${Object.values(artifacts).join(", ")}`);
  process.exit(exitCodeForResult(report));
}

main().catch((error) => {
  const isExpected = error instanceof ObserveVerifyConfigError || error.name?.startsWith("ObserveVerify");
  console.error(`${isExpected ? "❌" : "💥"} verify-observe 오류: ${error.message}`);
  if (!isExpected && error.stack) console.error(error.stack);
  process.exit(2);
});
