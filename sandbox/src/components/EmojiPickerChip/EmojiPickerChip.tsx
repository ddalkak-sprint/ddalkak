interface EmojiPickerChipProps {
  emoji: string;
  count: string;
  /** 브릿지 원본 배경 농도 — 1행 0.54, 2행 0.5 (디자인 의도 미확인, 원본 승계 — plan ⚠4) */
  overlay: 54 | 50;
}

export default function EmojiPickerChip({ emoji, count, overlay }: EmojiPickerChipProps) {
  return (
    <div
      className={`flex h-[38px] w-[72px] items-center justify-center gap-0.5 rounded-[40px] ${
        overlay === 54 ? "bg-black/[0.54]" : "bg-black/[0.5]"
      }`}
    >
      <span className="text-[18px] leading-[27px] tracking-[-0.2px]">{emoji}</span>
      <span className="text-[16px] font-semibold leading-[27px] tracking-[-0.2px] text-white">{count}</span>
    </div>
  );
}
