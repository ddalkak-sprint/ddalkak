import { chromium } from "playwright";

export class VisualVerifyCaptureError extends Error {
  constructor(message) {
    super(message);
    this.name = "VisualVerifyCaptureError";
  }
}

export async function captureRender({ url, selector, viewport, timeoutMs, outputPath }) {
  if (!url) {
    throw new VisualVerifyCaptureError("--url이 필요합니다. sandbox는 기본값 http://localhost:5173를 사용합니다.");
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

    const target = selector === "body" ? page : page.locator(selector).first();
    if (selector !== "body" && await target.count() === 0) {
      throw new VisualVerifyCaptureError(`selector를 찾을 수 없습니다: ${selector}`);
    }
    try {
      await target.screenshot({
        path: outputPath,
        animations: "disabled",
        caret: "hide",
        scale: "css"
      });
    } catch (error) {
      throw new VisualVerifyCaptureError(`screenshot 캡처 실패: ${error.message}`);
    }
  } finally {
    await browser.close();
  }
}
