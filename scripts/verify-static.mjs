#!/usr/bin/env node
// 정적 검산기 진입점 shim — 실제 구현은 verify-static/ 폴더로 분리돼 있다.
// 기존 호출 경로(node scripts/verify-static.mjs <projectRoot> <name>)를 그대로 보존한다.
import "./verify-static/index.mjs";
