#!/usr/bin/env node
// login-page visual verify용 synthetic baseline screenshot fixture를 생성한다.
// 실제 제품 검증 baseline이 아니다. sandbox 앱을 렌더링한 뒤 의도적 불일치 2건
// (input height, signup link color)만 정답 상태로 보정해 엔진 실험용 기준 이미지를 만든다.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "shared", "examples", "assets", "login-page");
const appUrl = process.env.DDALKAK_BASELINE_URL ?? "http://127.0.0.1:5173";
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "logo.svg"), logoSvg());

const browser = await chromium.launch();
try {
  await renderBaseline({
    browser,
    viewport: { width: 1440, height: 900 },
    url: appUrl,
    out: join(outDir, "desktop.png")
  });
  await renderBaseline({
    browser,
    viewport: { width: 375, height: 812 },
    url: appUrl,
    out: join(outDir, "mobile.png")
  });
} finally {
  await browser.close();
}

console.log(`✅ login-page baseline 생성 완료: ${outDir}`);

async function renderBaseline({ browser, viewport, url, out }) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.addStyleTag({
    content: `
      input { height: 48px !important; }
      a[href="#"] { color: #3B82F6 !important; }
    `
  });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.screenshot({ path: out, animations: "disabled", caret: "hide", scale: "css" });
  await page.close();
}

function logoSvg(className = "") {
  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" fill="none">
  <rect width="48" height="48" rx="12" fill="#3B82F6"/>
  <path d="M14 30L24 14L34 30" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="24" cy="33" r="3" fill="#FFFFFF"/>
</svg>`;
}
