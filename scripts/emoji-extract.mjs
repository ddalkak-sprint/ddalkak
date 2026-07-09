#!/usr/bin/env node
// 이모지 asset 추출기 (벡터 이모지 세트)
//
// 이모지를 텍스트로 렌더하면 브라우저·OS마다 시스템 이모지로 폴백돼 디자인과 다르게, 그리고
// 환경마다 다르게 그려진다. 그래서 이모지를 결정론적인 벡터 asset(SVG)으로 고정한다.
// 벡터라 모든 해상도에서 선명하고 배경이 투명하다.
//
// 원천은 공개 이모지 세트(기본 Twemoji)다. Figma가 쓴 세트와 글리프 모양이 완전히 같지는 않다 —
// Figma↔브라우저 이모지 래스터는 본질적으로 다르므로 픽셀 완전일치는 목표가 아니다. verify의 이모지
// 영역 불일치는 게이트를 콘텐츠 인지형으로 다루는 검증쪽 몫이고, 여기서는 "올바른 이모지가 선명하게,
// 환경 불문 동일하게" 나오는 것을 보장한다.
//
// 사용: node scripts/emoji-extract.mjs --project sandbox --name pc-home [--set twemoji]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, relative } from "node:path";

function parseArgs(argv) {
  const args = { project: ".", name: null, set: "twemoji" };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") args.project = argv[++i];
    else if (a === "--name") args.name = argv[++i];
    else if (a === "--set") args.set = argv[++i];
  }
  return args;
}

// content가 이모지 글리프뿐인지 판정한다. 최소 하나의 Extended_Pictographic을 포함하고,
// 이모지 클러스터 구성요소(변형 선택자·ZWJ·피부톤·키캡)와 공백을 걷어내면 남는 게 없어야 한다.
const CLUSTER_PART = /[\p{Extended_Pictographic}‍️\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}⃣#*0-9]|\s/gu;
function isEmojiOnly(s) {
  if (!s) return false;
  if (!/\p{Extended_Pictographic}/u.test(s)) return false;
  return s.replace(CLUSTER_PART, "") === "";
}

// 이모지 세트 파일명 규약: 코드포인트 hex를 '-'로 잇고, 변형 선택자(FE0F)·ZWJ는 뺀다(Twemoji 규약).
function codepointSlug(s) {
  const cps = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d || /\s/.test(ch)) continue;
    cps.push(cp.toString(16));
  }
  return cps.join("-");
}

function svgUrl(set, slug) {
  if (set === "twemoji") return `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${slug}.svg`;
  if (set === "noto") return `https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji/svg/emoji_u${slug.replace(/-/g, "_")}.svg`;
  throw new Error(`알 수 없는 이모지 세트: ${set}`);
}

function collectEmoji(screen, found) {
  const walk = (node) => {
    if (node.type === "text" && isEmojiOnly(node.content ?? "")) {
      const slug = codepointSlug(node.content);
      found.set(slug, { slug, fileName: `emoji_${slug}.svg`, assetId: `asset-emoji-${slug}`, nodes: [] });
      found.get(slug).nodes.push(node);
    }
    for (const c of node.children ?? []) walk(c);
  };
  for (const n of screen.nodes ?? []) walk(n);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.name) throw new Error("--name 이 필요합니다");
  const projectRoot = resolve(process.cwd(), args.project);
  const bridgePath = join(projectRoot, ".ddalkak", "bridge", `${args.name}.bridge.json`);
  if (!existsSync(bridgePath)) throw new Error(`bridge를 찾을 수 없습니다: ${bridgePath}`);

  const bridge = JSON.parse(readFileSync(bridgePath, "utf-8"));
  const screens = bridge.screens ?? [bridge];

  const found = new Map();
  for (const screen of screens) collectEmoji(screen, found);
  if (found.size === 0) {
    console.log("이모지 글리프 텍스트 노드가 없습니다.");
    return;
  }

  const assetDir = join(projectRoot, ".ddalkak", "assets", args.name);
  const srcAssetDir = join(projectRoot, "src", "assets", args.name);
  mkdirSync(assetDir, { recursive: true });

  bridge.assets = bridge.assets ?? [];
  let ok = 0;
  for (const item of found.values()) {
    const url = svgUrl(args.set, item.slug);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`skip ${item.slug}: ${args.set} ${res.status}`);
      continue;
    }
    const svg = await res.text();
    writeFileSync(join(assetDir, item.fileName), svg);
    if (existsSync(srcAssetDir)) writeFileSync(join(srcAssetDir, item.fileName), svg);

    const exportRel = relative(projectRoot, join(assetDir, item.fileName)).split("\\").join("/");
    if (!bridge.assets.some((a) => a.id === item.assetId)) {
      bridge.assets.push({ id: item.assetId, kind: "vector", export: exportRel, format: "svg" });
    }
    for (const node of item.nodes) {
      node.ref = item.assetId;
      node.emojiAsset = true;
    }
    ok++;
    console.log(`wrote ${item.fileName} <- ${args.set}`);
  }

  // 정본은 compact — pretty 저장은 브릿지를 4배 불려 하류 읽기 토큰(=시간)을 낭비한다 (rules §14)
  writeFileSync(bridgePath, JSON.stringify(bridge) + "\n", "utf-8");
  console.log(`\n총 ${ok}개 이모지 asset(${args.set}), bridge 갱신: ${relative(process.cwd(), bridgePath)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
