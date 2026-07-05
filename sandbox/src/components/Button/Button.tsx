import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export default function Button({ label, ...rest }: ButtonProps) {
  return (
    <button
      className="h-12 w-full rounded-lg bg-primary text-label-sm font-medium text-surface transition-colors hover:bg-primary-hover"
      {...rest}
    >
      {label}
    </button>
  );
}
