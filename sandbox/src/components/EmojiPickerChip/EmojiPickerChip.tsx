interface EmojiPickerChipProps {
  emoji: string;
  count: string;
  /** 스펙상 오버레이 농도 — 1행 54%, 2행 50% */
  overlay?: 54 | 50;
}

export default function EmojiPickerChip({ emoji, count, overlay = 54 }: EmojiPickerChipProps) {
  return (
    <div
      className={`flex h-[38px] w-[72px] items-center justify-center gap-[2px] rounded-[40px] ${overlay === 54 ? "bg-black/[.54]" : "bg-black/[.5]"}`}
    >
      <span className="text-[18px] leading-[27px] tracking-[-0.2px]">{emoji}</span>
      <span className="text-[16px] font-semibold leading-[27px] tracking-[-0.2px] text-white">{count}</span>
    </div>
  );
}
