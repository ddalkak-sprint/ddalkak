// 렌더 관측 — Playwright로 뷰포트를 프레임 크기에 맞춰 열고 DOM 전체를 수확한다.
// 요소마다 기하(rect)·computed style·직속/자손 텍스트·유효 배경(조상 투과 — v1 오탐 교훈)을 기록한다.
import { chromium } from "playwright";

export class ObserveVerifyCaptureError extends Error {
  constructor(message) {
    super(message);
    this.name = "ObserveVerifyCaptureError";
  }
}

export async function observePage({ url, viewport, timeoutMs }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(url, { timeout: timeoutMs });
    } catch (error) {
      throw new ObserveVerifyCaptureError(`렌더 URL 접속 실패: ${url} (${error.message})`);
    }
    await page.addStyleTag({
      content: `*, *::before, *::after {
        animation-duration: 0s !important; animation-delay: 0s !important;
        transition-duration: 0s !important; transition-delay: 0s !important;
        caret-color: transparent !important; scroll-behavior: auto !important;
      }`,
    });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});

    const elements = await page.evaluate(() => {
      const out = [];
      let clock = 0; // DFS enter/exit 번호 — 포함 관계 판정용
      const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
      function visit(el, inheritedBg, inheritedSrc) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        const r = el.getBoundingClientRect();
        let own = "";
        for (const c of el.childNodes) if (c.nodeType === 3) own += c.textContent;
        const bgOwn = cs.backgroundColor;
        const opaque = !/rgba\(.*,\s*0\)$/.test(bgOwn) && bgOwn !== "transparent";
        const effBg = opaque ? bgOwn : inheritedBg;
        // 다리 B: 검증 빌드가 주입한 소스 위치. 없는 요소(래퍼 등)는 조상 것을 상속한다.
        const srcOwn = el.getAttribute("data-src");
        const srcLoc = srcOwn ?? inheritedSrc;
        const rec = {
          i: out.length,
          tag: el.tagName.toLowerCase(),
          enter: clock++,
          rect: [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10),
          ownText: norm(own),
          deepText: norm(el.textContent),
          color: cs.color,
          effBg,
          fontSize: parseFloat(cs.fontSize),
          fontWeight: cs.fontWeight,
          lineHeight: cs.lineHeight,
          borderRadius: cs.borderTopLeftRadius,
          src: el.tagName === "IMG" ? (el.currentSrc || el.src || "").split("/").pop().split("?")[0] : null,
          // input/textarea의 placeholder — Figma 텍스트가 DOM 텍스트 노드가 아니라 속성으로 렌더되는 경우의 매칭 키
          placeholder:
            el.tagName === "INPUT" || el.tagName === "TEXTAREA" ? norm(el.getAttribute("placeholder")) || null : null,
          srcLoc: srcLoc ?? null,
          exit: 0,
        };
        out.push(rec);
        for (const c of el.children) visit(c, effBg, srcLoc);
        rec.exit = clock++;
      }
      visit(document.body, "rgb(255, 255, 255)", null);
      return out;
    });

    const screenshot = await page.screenshot({ animations: "disabled", caret: "hide", scale: "css" });
    return { elements, screenshot };
  } finally {
    await browser.close();
  }
}
