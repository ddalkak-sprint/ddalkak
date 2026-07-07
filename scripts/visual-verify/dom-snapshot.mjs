export async function collectDomSnapshot(page) {
  return page.evaluate(() => {
    const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const round = (value) => Math.round(value * 100) / 100;
    const rectToBox = (rect) => ({
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height)
    });
    const isVisibleBox = (box) => box.width > 0 && box.height > 0;
    const styleOf = (element) => {
      const style = window.getComputedStyle(element);
      return {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderTopColor,
        borderWidth: style.borderTopWidth,
        borderRadius: style.borderTopLeftRadius,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        textDecorationLine: style.textDecorationLine,
        alignItems: style.alignItems,
        justifyContent: style.justifyContent
      };
    };
    const visibleByStyle = (style) => style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
    const elements = [];
    let elementIndex = 0;
    for (const element of document.querySelectorAll("body *")) {
      const style = styleOf(element);
      const bbox = rectToBox(element.getBoundingClientRect());
      if (!isVisibleBox(bbox) || !visibleByStyle(style)) continue;
      elements.push({
        id: `element:${elementIndex++}`,
        kind: "element",
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role") ?? "",
        text: normalize(element.innerText || element.textContent),
        bbox,
        style,
        attributes: {
          href: element.getAttribute("href") ?? "",
          alt: element.getAttribute("alt") ?? "",
          type: element.getAttribute("type") ?? "",
          class: element.getAttribute("class") ?? ""
        }
      });
    }

    const textNodes = [];
    let textIndex = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = normalize(node.nodeValue);
      if (!text) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const style = styleOf(parent);
      if (!visibleByStyle(style)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].map(rectToBox).filter(isVisibleBox);
      range.detach();
      for (const rect of rects) {
        textNodes.push({
          id: `text:${textIndex++}`,
          kind: "text",
          tag: parent.tagName.toLowerCase(),
          text,
          bbox: rect,
          style,
          parentText: normalize(parent.innerText || parent.textContent)
        });
      }
    }

    return {
      url: location.href,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      elements,
      textNodes
    };
  });
}
