import { chromium } from "playwright";
import { collectDomSnapshot } from "./dom-snapshot.mjs";

export class VisualVerifyCaptureError extends Error {
  constructor(message) {
    super(message);
    this.name = "VisualVerifyCaptureError";
  }
}

// Playwright renders web today. Flutter Web also renders in a browser, so a flutter target reuses
// this same screenshot path — its runtime (e.g. `fvm flutter run -d web-server`) is launched
// outside verify and passed in as a URL, exactly like the web dev server. Flutter paints to a
// canvas, so there is no meaningful DOM to snapshot; style checks degrade to pixel-only (index.mjs).
const PLAYWRIGHT_PLATFORMS = new Set(["web", "flutter"]);
const CANVAS_PLATFORMS = new Set(["flutter"]);

export async function captureRender({ url, selector, viewport, timeoutMs, outputPath, target }) {
  const platform = target?.platform ?? "web";
  if (!PLAYWRIGHT_PLATFORMS.has(platform)) {
    throw new VisualVerifyCaptureError(
      `verify target '${target?.id ?? platform}' uses platform '${platform}', but only the web and flutter (Playwright) providers are implemented. Add a provider for '${target?.screenshotProvider ?? platform}' or run a web/flutter target.`
    );
  }
  if (!url) {
    throw new VisualVerifyCaptureError("--url이 필요합니다. sandbox는 기본값 http://localhost:5173를 사용합니다.");
  }
  if (selector !== "body") {
    throw new VisualVerifyCaptureError("v2.0은 body 전체 캡처만 지원합니다. --selector body를 사용하세요.");
  }

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: "reduce"
    });

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    } catch (error) {
      throw new VisualVerifyCaptureError(`렌더 URL 접속 실패: ${url} (${error.message})`);
    }
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          caret-color: transparent !important;
          scroll-behavior: auto !important;
        }
      `
    });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    // Flutter Web boots asynchronously (engine JS + CanvasKit) and paints its first frame well
    // after network idle — without waiting, the screenshot is a blank page. Wait for the Flutter
    // view host element, then give the raster thread a beat to paint. Skipped for data: URLs so
    // the engine test's plain-HTML stand-in doesn't stall on a selector that never appears.
    if (CANVAS_PLATFORMS.has(platform) && !url.startsWith("data:")) {
      await page.waitForSelector("flutter-view, flt-glass-pane", { timeout: timeoutMs }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    let domSnapshot = null;
    try {
      await page.screenshot({
        path: outputPath,
        animations: "disabled",
        caret: "hide",
        scale: "css"
      });
      // Canvas-rendered platforms (Flutter Web) expose no meaningful DOM — skip the snapshot so the
      // engine falls back to pixel-only verification instead of matching against an empty DOM.
      if (!CANVAS_PLATFORMS.has(platform)) {
        domSnapshot = await collectDomSnapshot(page);
      }
    } catch (error) {
      throw new VisualVerifyCaptureError(`screenshot 캡처 실패: ${error.message}`);
    }
    return { domSnapshot };
  } finally {
    await browser.close();
  }
}
