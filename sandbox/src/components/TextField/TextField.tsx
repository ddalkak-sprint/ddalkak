import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function TextField({ label, ...rest }: TextFieldProps) {
  return (
    <label className="flex w-full flex-col gap-2">
      <span className="text-label-sm font-medium text-text-strong">{label}</span>
      {/* 의도적 불일치 #1 (verify 테스트용): 스펙은 48px(h-12), 구현은 44px(h-11) */}
      <input
        className="h-11 w-full rounded-lg border border-border px-4 text-body-md text-text-strong outline-none focus:border-primary"
        {...rest}
      />
    </label>
  );
}
