import type { ButtonHTMLAttributes } from "react";

interface HomeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: "outlined" | "primary";
  size?: 40 | 56;
}

const VARIANT_CLASSES = {
  outlined: "border border-gray-300 bg-white text-gray-900",
  primary: "bg-purple-600 text-white",
} as const;

const SIZE_CLASSES = {
  40: "h-10 rounded-[6px] px-4 text-font-16-bold",
  56: "h-14 rounded-xl px-6 text-font-18-bold",
} as const;

export default function HomeButton({
  label,
  variant = "primary",
  size = 56,
  className = "",
  ...rest
}: HomeButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center font-bold ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {label}
    </button>
  );
}
