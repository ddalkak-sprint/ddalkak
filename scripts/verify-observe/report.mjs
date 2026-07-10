// 리포트 — observe.json이 단일 정본, observe.md는 그것의 렌더링 (verify-static과 동일 원칙).
// 같은 입력 → 동일 출력 유지를 위해 타임스탬프를 넣지 않는다.
// 주장 범위는 "스펙(bridge.json) 일치"까지 — bbox가 스크린샷과 모순인 사례가 실측됐으므로
// "Figma 일치"는 스크린샷 층(visual-verify)의 몫이다.

export function buildReport({ name, screen, url, viewport, leaves, matched, missing, unmatchable, matchStats, containers, derived, findings, tol, tolMinor }) {
  const majors = findings.filter((f) => f.severity === "major");
  const minors = findings.filter((f) => f.severity === "minor");
  const verdict = majors.length ? "fail" : minors.length ? "conditional" : "pass";
  return {
    tool: "verify-observe",
    claimScope: "bridge-spec", // "Figma 일치"가 아니라 "bridge 스펙 일치"를 주장한다
    name,
    screen: screen.name ?? name,
    url,
    viewport,
    thresholds: { tol, tolMinor },
    summary: {
      verdict,
      leaves: leaves.length,
      matched: matched.size,
      missing: missing.length,
      major: majors.length,
      minor: minors.length,
      matching: matchStats,
    },
    coverage: {
      // 조용한 누락 금지 — 채점하지 못한 범위를 명시한다
      unmatchableLeaves: unmatchable.map((l) => ({ path: l.path, name: l.name ?? null })),
      underivedContainers: containers
        .filter((c) => !derived.has(c.path))
        .map((c) => ({ path: c.path, name: c.name ?? null })),
    },
    findings,
  };
}

export function renderMarkdown(report) {
  const s = report.summary;
  const icon = { pass: "✅", conditional: "⚠️", fail: "❌" }[s.verdict];
  const lines = [
    `# verify-observe — ${report.name} (${report.screen})`,
    "",
    `${icon} **판정: ${s.verdict}** · 주장 범위: bridge 스펙 일치 (Figma 일치 아님)`,
    "",
    `| 항목 | 값 |`,
    `| --- | --- |`,
    `| 리프 매칭 | ${s.matched} / ${s.leaves} (누락 ${s.missing}) |`,
    `| 매칭 방법 | ${Object.entries(s.matching).map(([k, v]) => `${k} ${v}`).join(" · ") || "—"} |`,
    `| 위반 | major ${s.major} · minor ${s.minor} (tol ${report.thresholds.tol}px, minor 경계 ${report.thresholds.tolMinor}px) |`,
    `| 미채점 | 단서 없는 리프 ${report.coverage.unmatchableLeaves.length} · 미유도 컨테이너 ${report.coverage.underivedContainers.length} |`,
    "",
  ];
  if (report.findings.length) {
    lines.push(`## 위반 (${report.findings.length})`, "", `| 심각도 | 종류 | 위치 | 기대 | 실측 | 소스 |`, `| --- | --- | --- | --- | --- | --- |`);
    for (const f of report.findings) {
      lines.push(`| ${f.severity} | ${f.kind} | \`${f.path}\` ${escapeCell(f.where)} | ${escapeCell(f.expected)} | ${escapeCell(f.actual)} | ${f.src ? `\`${escapeCell(f.src)}\`` : "—"} |`);
    }
    lines.push("");
  }
  if (report.coverage.underivedContainers.length) {
    lines.push(
      `## 미유도 컨테이너 (${report.coverage.underivedContainers.length}) — 매칭된 자손 리프 2개 미만`,
      "",
      ...report.coverage.underivedContainers.map((c) => `- \`${c.path}\` ${c.name ?? ""}`),
      "",
    );
  }
  lines.push(`> minor = 위반이지만 ${report.thresholds.tolMinor}px 이하 — 이모지 글리프 폭·서브픽셀 등 렌더링 노이즈일 가능성. 사람 확인 우선순위는 major부터.`, "");
  return lines.join("\n");
}

function escapeCell(v) {
  return String(v ?? "—").replaceAll("|", "\\|");
}
