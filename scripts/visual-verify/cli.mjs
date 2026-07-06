#!/usr/bin/env node
import { parseArgs, VisualVerifyConfigError } from "./config.mjs";
import { exitCodeForResult, runVisualVerify } from "./index.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runVisualVerify(args);

  console.log(`${statusIcon(result.status)} visual verify ${result.status}: ${result.name}/${result.screen} confidence ${(result.confidence * 100).toFixed(3)}%`);
  console.log(`artifacts: ${result.artifacts.report}, ${result.artifacts.visual}, ${result.artifacts.diff}`);
  process.exit(exitCodeForResult(result));
}

function statusIcon(status) {
  if (status === "pass") return "✅";
  if (status === "conditional") return "⚠️";
  return "❌";
}

main().catch((error) => {
  const isExpected = error instanceof VisualVerifyConfigError || error.name?.startsWith("VisualVerify");
  console.error(`${isExpected ? "❌" : "💥"} visual verify error: ${error.message}`);
  if (!isExpected && error.stack) console.error(error.stack);
  process.exit(2);
});
