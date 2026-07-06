interface ReactionChipProps {
  emoji?: string;
  count: string;
}

export default function ReactionChip({ emoji, count }: ReactionChipProps) {
  return (
    <div className="flex h-[33px] items-center gap-0.5 rounded-[32px] bg-black/[0.54] px-3 py-1.5">
      {emoji && <span className="text-[15px] leading-[19px]">{emoji}</span>}
      <span className="text-[15px] leading-[22px] tracking-[-0.1px] text-white">{count}</span>
    </div>
  );
}
