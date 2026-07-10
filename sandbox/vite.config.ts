import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// 검증 빌드 전용(DDALKAK_VERIFY=1): 모든 JSX 호스트 요소에 data-src="파일:줄:칼럼"을 주입해
// verify-observe 리포트가 소스 위치를 가리킬 수 있게 한다. 프로덕션 빌드에는 영향 없음.
import dataSrc from "../scripts/verify-observe/babel-data-src.mjs";

export default defineConfig({
  plugins: [
    react(
      process.env.DDALKAK_VERIFY
        ? { babel: { plugins: [[dataSrc, { root: process.cwd() }]] } }
        : undefined,
    ),
  ],
});
