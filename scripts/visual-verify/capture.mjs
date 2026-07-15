import { chromium } from "playwright";
import { collectDomSnapshot } from "./dom-snapshot.mjs";

export class VisualVerifyCaptureError extends Error {
  constructor(message) {
    super(message);
    this.name = "VisualVerifyCaptureError";
  }
}

export async function captureRender({ url, selector, viewport, timeoutMs, outputPath, target }) {
  const platform = target?.platform ?? "web";
  if (platform !== "web") {
    throw new VisualVerifyCaptureError(
      `verify target '${target?.id ?? platform}' uses platform '${platform}', but only the web Playwright provider is implemented. Add a provider for '${target?.screenshotProvider ?? platform}' or run a web target.`
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

    let domSnapshot;
    try {
      await page.screenshot({
        path: outputPath,
        animations: "disabled",
        caret: "hide",
        scale: "css"
      });
      domSnapshot = await collectDomSnapshot(page);
    } catch (error) {
      throw new VisualVerifyCaptureError(`screenshot 캡처 실패: ${error.message}`);
    }
    return { domSnapshot };
  } finally {
    await browser.close();
  }
}
