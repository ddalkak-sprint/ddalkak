#!/usr/bin/env node
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { exitCodeForResult, runVisualVerify } from "./index.mjs";

const tests = [
  ["pixel pass returns exit 0", testPixelPass],
  ["pixel fail returns exit 1", testPixelFail],
  ["style fail is advisory and keeps pixel pass", testStyleAdvisory],
  ["non-body selector returns execution error", testSelectorError],
  ["missing baseline returns config error", testMissingBaseline]
];

async function main() {
  let failed = 0;
  for (const [name, test] of tests) {
    try {
      await test();
      console.log(`✅ ${name}`);
    } catch (error) {
      failed++;
      console.error(`❌ ${name}`);
      console.error(`   ${error.message}`);
    }
  }

  if (failed) {
    console.error(`\nvisual verify engine tests failed: ${failed}/${tests.length}`);
    process.exit(1);
  }
  console.log(`\nvisual verify engine tests passed: ${tests.length}/${tests.length}`);
}

async function testPixelPass() {
  await withProject("vv-pass-", async (projectRoot) => {
    const url = dataUrl(textPage({ color: "rgb(255, 0, 0)" }));
    await writeBaseline({ projectRoot, url, viewport: { width: 120, height: 40 } });
    writeBridge({
      projectRoot,
      name: "pass",
      node: textNode({ fill: "#ff0000" })
    });

    const result = await runVisualVerify({ project: projectRoot, name: "pass", url });
    assert(result.status === "pass", `expected pass, got ${result.status}`);
    assert(exitCodeForResult(result) === 0, "expected exit 0");
    assert(result.checks.gating === false, "expected checks.gating=false");
  });
}

async function testPixelFail() {
  await withProject("vv-fail-", async (projectRoot) => {
    const baselineUrl = dataUrl(boxPage({ color: "#000" }));
    const actualUrl = dataUrl(boxPage({ color: "#fff" }));
    await writeBaseline({ projectRoot, url: baselineUrl, viewport: { width: 80, height: 80 } });
    writeBridge({
      projectRoot,
      name: "fail",
      frame: { w: 80, h: 80 },
      node: {
        type: "frame",
        name: "box",
        style: { fills: [{ type: "solid", color: "#000000" }] },
        bbox: [0, 0, 80, 80]
      }
    });

    const result = await runVisualVerify({ project: projectRoot, name: "fail", url: actualUrl });
    assert(result.status === "fail", `expected fail, got ${result.status}`);
    assert(exitCodeForResult(result) === 1, "expected exit 1");
  });
}

async function testStyleAdvisory() {
  await withProject("vv-advisory-", async (projectRoot) => {
    const url = dataUrl(textPage({ color: "rgb(255, 0, 0)" }));
    await writeBaseline({ projectRoot, url, viewport: { width: 120, height: 40 } });
    writeBridge({
      projectRoot,
      name: "advisory",
      node: textNode({ fill: "#000000" })
    });

    const result = await runVisualVerify({ project: projectRoot, name: "advisory", url });
    const colorFail = result.checks.items.find((item) => item.id === "advisory/hello:text.color");
    assert(result.status === "pass", `expected pixel gate pass, got ${result.status}`);
    assert(result.statuses.pixel === "pass", `expected pixel pass, got ${result.statuses.pixel}`);
    assert(result.statuses.style === "fail", `expected advisory style fail, got ${result.statuses.style}`);
    assert(result.checks.gating === false, "expected checks.gating=false");
    assert(exitCodeForResult(result) === 0, "expected exit 0 because style is advisory");
    assert(colorFail?.status === "fail", "expected advisory text color fail");
  });
}

async function testSelectorError() {
  await withProject("vv-selector-", async (projectRoot) => {
    const url = dataUrl(textPage({ color: "rgb(255, 0, 0)" }));
    await writeBaseline({ projectRoot, url, viewport: { width: 120, height: 40 } });
    writeBridge({
      projectRoot,
      name: "selector",
      node: textNode({ fill: "#ff0000" })
    });

    await assertRejects(
      () => runVisualVerify({ project: projectRoot, name: "selector", url, selector: "main" }),
      (error) => error.name === "VisualVerifyCaptureError" && error.message.includes("body 전체 캡처")
    );
  });
}

async function testMissingBaseline() {
  await withProject("vv-missing-", async (projectRoot) => {
    mkdirSync(join(projectRoot, ".ddalkak", "bridge"), { recursive: true });
    writeBridge({
      projectRoot,
      name: "missing",
      node: textNode({ fill: "#ff0000" }),
      skipAssetFile: true
    });

    await assertRejects(
      () => runVisualVerify({ project: projectRoot, name: "missing", url: dataUrl(textPage({ color: "red" })) }),
      (error) => error.name === "VisualVerifyConfigError" && error.message.includes("baseline screenshot 파일 없음")
    );
  });
}

async function withProject(prefix, fn) {
  const projectRoot = mkdtempSync(join(tmpdir(), prefix));
  try {
    await fn(projectRoot);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

async function writeBaseline({ projectRoot, url, viewport }) {
  mkdirSync(join(projectRoot, ".ddalkak", "assets"), { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.screenshot({
      path: join(projectRoot, ".ddalkak", "assets", "baseline.png"),
      animations: "disabled",
      caret: "hide",
      scale: "css"
    });
  } finally {
    await browser.close();
  }
}

function writeBridge({ projectRoot, name, frame = { w: 120, h: 40 }, node, skipAssetFile = false }) {
  mkdirSync(join(projectRoot, ".ddalkak", "bridge"), { recursive: true });
  if (!skipAssetFile) mkdirSync(join(projectRoot, ".ddalkak", "assets"), { recursive: true });
  const bridge = {
    tokens: {
      color: {
        red: "#ff0000",
        black: "#000000"
      },
      type: {
        body: { size: 16, weight: 400, lineHeight: 20 }
      }
    },
    screens: [
      {
        name,
        breakpoint: "desktop",
        frame,
        screenshot: "baseline",
        nodes: [node]
      }
    ],
    assets: [
      {
        id: "baseline",
        export: ".ddalkak/assets/baseline.png"
      }
    ]
  };
  writeFileSync(join(projectRoot, ".ddalkak", "bridge", `${name}.bridge.json`), `${JSON.stringify(bridge, null, 2)}\n`);
}

function textNode({ fill }) {
  return {
    type: "text",
    name: "hello",
    content: "Hello",
    style: {
      font: "@type.body",
      fills: [{ type: "solid", color: fill }]
    },
    bbox: [0, 0, 40, 20]
  };
}

function textPage({ color }) {
  return `<!doctype html><html><body style="margin:0;background:#fff"><div style="color:${color};font-size:16px;font-weight:400;line-height:20px;font-family:Arial, sans-serif">Hello</div></body></html>`;
}

function boxPage({ color }) {
  return `<!doctype html><html><body style="margin:0;background:${color}"></body></html>`;
}

function dataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function assertRejects(fn, predicate) {
  try {
    await fn();
  } catch (error) {
    if (predicate(error)) return;
    throw new Error(`unexpected rejection: ${error.name}: ${error.message}`);
  }
  throw new Error("expected rejection");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
