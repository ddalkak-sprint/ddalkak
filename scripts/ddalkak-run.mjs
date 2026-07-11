#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

class RunnerError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "RunnerError";
    this.exitCode = exitCode;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) throw new RunnerError(`알 수 없는 인자: ${arg}`);
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveRun(args) {
  const projectRoot = resolve(args.project ?? process.cwd());
  const configPath = resolve(projectRoot, ".ddalkak", "ddalkak.config.json");
  const config = existsSync(configPath) ? readJson(configPath) : {};
  const name = args.name ?? config.name;
  if (!name) throw new RunnerError("--name 또는 .ddalkak/ddalkak.config.json.name이 필요합니다.");
  if (!args.url) throw new RunnerError("--url이 필요합니다.");

  const bridgePath = resolve(projectRoot, ".ddalkak", "bridge", `${name}.bridge.json`);
  const planPath = resolve(projectRoot, ".ddalkak", "plan", `${name}.plan.md`);
  return {
    projectRoot,
    name,
    url: args.url,
    screen: args.screen,
    bridgePath,
    planPath
  };
}

function runStep(label, command, args, options = {}) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    shell: false
  });
  if (result.error) throw new RunnerError(`${label} 실행 실패: ${result.error.message}`);
  return result.status ?? 0;
}

function requireFile(path, label) {
  if (!existsSync(path)) throw new RunnerError(`${label} 파일 없음: ${path}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const run = resolveRun(args);

  requireFile(run.bridgePath, "bridge");
  requireFile(run.planPath, "plan");

  const gateSteps = [
    ["validate-bridge", [resolve(repoRoot, "scripts", "validate-bridge.mjs"), run.bridgePath]],
    ["validate-plan", [resolve(repoRoot, "scripts", "validate-plan.mjs"), run.planPath, run.bridgePath]],
    ["validate-code", [resolve(repoRoot, "scripts", "validate-code.mjs"), run.planPath, run.bridgePath, run.projectRoot]]
  ];

  for (const [label, stepArgs] of gateSteps) {
    const code = runStep(label, process.execPath, stepArgs);
    if (code !== 0) throw new RunnerError(`${label} 실패로 중단`, code);
  }

  const verifyArgs = [
    resolve(repoRoot, "scripts", "visual-verify", "cli.mjs"),
    "--project", run.projectRoot,
    "--name", run.name,
    "--url", run.url
  ];
  if (run.screen) verifyArgs.push("--screen", run.screen);

  const verifyCode = runStep("visual-verify", process.execPath, verifyArgs);
  if (verifyCode === 2) throw new RunnerError("visual-verify 설정/실행 오류로 finalize 없이 중단", 2);

  const finalizeArgs = [
    resolve(repoRoot, "scripts", "finalize-report.mjs"),
    "--project", run.projectRoot,
    "--name", run.name
  ];
  if (run.screen) finalizeArgs.push("--screen", run.screen);
  const finalizeCode = runStep("finalize-report", process.execPath, finalizeArgs);
  if (finalizeCode !== 0) throw new RunnerError("finalize-report 실패", finalizeCode);

  const finalPath = resolve(run.projectRoot, ".ddalkak", "reports", `${run.name}.final.json`);
  const finalReport = readJson(finalPath);
  console.log(`\n최종 구현율: ${finalReport.implementationRate.toFixed(3)}% (${finalReport.status})`);
  process.exit(verifyCode === 0 ? 0 : 1);
}

main().catch((error) => {
  const isExpected = error instanceof RunnerError;
  console.error(`${isExpected ? "❌" : "💥"} ddalkak-run error: ${error.message}`);
  if (!isExpected && error.stack) console.error(error.stack);
  process.exit(isExpected ? error.exitCode : 2);
});
