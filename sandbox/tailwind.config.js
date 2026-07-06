/** 딸깍 브릿지 토큰 매핑 — .ddalkak/bridge/login-page.bridge.json tokens 기준 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#3B82F6",
        "primary-hover": "#2563EB",
        "text-strong": "#111827",
        "text-muted": "#6B7280",
        border: "#E5E7EB",
        surface: "#FFFFFF",
        background: "#F9FAFB",
        error: "#EF4444",
        // pc-home 브릿지 토큰 (pc-home.bridge.json). surface는 기존과 값이 달라 스코프(-home)
        "purple-600": "#9935FF",
        "purple-700": "#861DEE",
        "purple-200": "#ECD9FF",
        "purple-50": "#A64EFF",
        "surface-home": "#F6F8FF",
        "gray-900": "#181818",
        "gray-500": "#555555",
        "gray-300": "#CCCCCC",
        "gray-200": "#EEEEEE",
        "gray-90": "#4A494F",
      },
      fontSize: {
        "heading-lg": ["28px", { lineHeight: "1.3" }],
        "body-md": ["16px", { lineHeight: "1.5" }],
        "label-sm": ["14px", { lineHeight: "1.4" }],
        // pc-home 브릿지 type 토큰
        "font-24-bold": ["24px", { lineHeight: "36px", letterSpacing: "-0.01em" }],
        "font-18-bold": ["18px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "font-18-regular": ["18px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "font-16-bold": ["16px", { lineHeight: "26px", letterSpacing: "-0.01em" }],
        "font-14-bold": ["14px", { lineHeight: "20px", letterSpacing: "-0.005em" }],
      },
      fontFamily: {
        pretendard: ["Pretendard", "sans-serif"],
        poppins: ["Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};
