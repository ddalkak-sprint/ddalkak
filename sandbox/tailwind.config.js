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
      },
      fontSize: {
        "heading-lg": ["28px", { lineHeight: "1.3" }],
        "body-md": ["16px", { lineHeight: "1.5" }],
        "label-sm": ["14px", { lineHeight: "1.4" }],
      },
    },
  },
  plugins: [],
};
