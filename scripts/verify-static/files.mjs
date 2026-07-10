// 파일 탐색 — plan.md "파일 계획" 표(주소록) + 폴백 src/ 스캔. 판단 근거 아님. (규칙 SSOT: §5)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { ctx } from "./context.mjs";

function parsePlanFiles(planPath) {
  if (!existsSync(planPath)) return [];
  const md = readFileSync(planPath, "utf8");
  const section = md.split(/^## /m).find((s) => s.startsWith("파일 계획"));
  if (!section) return [];
  const paths = [];
  for (const m of section.matchAll(/\|\s*`([^`]+)`\s*\|/g)) paths.push(m[1]);
  return paths;
}

function scanSrcFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) scanSrcFiles(p, acc);
    else if (/\.(tsx|jsx)$/.test(entry)) acc.push(relative(ctx.projectRoot, p));
  }
  return acc;
}

// plan 파일 계획 + src/ 스캔 결과를 ctx에 채운다.
export function discoverFiles() {
  const planPath = join(ctx.projectRoot, ".ddalkak", "plan", `${ctx.name}.plan.md`);
  const planFiles = parsePlanFiles(planPath);
  const planTsx = planFiles.filter((p) => /\.(tsx|jsx)$/.test(p) && existsSync(join(ctx.projectRoot, p)));
  const allSrcTsx = scanSrcFiles(join(ctx.projectRoot, "src"));
  const fallbackTsx = allSrcTsx.filter((p) => !planTsx.includes(p)); // 계획 이탈 후보
  Object.assign(ctx, { planTsx, allSrcTsx, fallbackTsx });
}
