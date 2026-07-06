#!/usr/bin/env node
// shared/examples의 목업 산출물을 sandbox/.ddalkak에 주입(리셋)한다.
// 사용법: node scripts/seed-sandbox.mjs   (또는 sandbox에서 npm run seed)

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const examples = join(root, "shared", "examples");
const target = join(root, "sandbox", ".ddalkak");

mkdirSync(join(target, "bridge"), { recursive: true });
mkdirSync(join(target, "plan"), { recursive: true });
mkdirSync(join(target, "reports"), { recursive: true });
rmSync(join(target, "reports"), { recursive: true, force: true });
mkdirSync(join(target, "reports"), { recursive: true });

cpSync(join(examples, "login-page.bridge.json"), join(target, "bridge", "login-page.bridge.json"));
cpSync(join(examples, "login-page.plan.md"), join(target, "plan", "login-page.plan.md"));
cpSync(join(examples, "ddalkak.config.json"), join(target, "ddalkak.config.json"));
if (existsSync(join(examples, "assets"))) {
  cpSync(join(examples, "assets"), join(target, "assets"), { recursive: true });
}
// reports는 비워둔다 — verify 단계가 직접 산출해야 테스트가 된다.

console.log("✅ sandbox/.ddalkak 시드 완료 (bridge/plan/config/assets 주입, reports는 비움)");
