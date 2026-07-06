import avatar from "../../assets/pc-home/img_avatar.png";

interface MessageCardProps {
  from: string;
  tag: string;
  tagColor: string;
  /** 태그 글자색 — 브릿지 suggestedProps에 없어 tag-label fill에서 파생 (plan ⚠3) */
  tagTextColor: string;
  message: string;
  date: string;
}

export default function MessageCard({ from, tag, tagColor, tagTextColor, message, date }: MessageCardProps) {
  return (
    <article className="flex h-[162px] w-[205px] flex-col rounded-xl border border-[#DBD9E9] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
      <div className="flex items-start gap-[7px]">
        <img src={avatar} alt={`${from} 아바타`} width={32} height={32} className="mt-[7px] rounded-full" />
        <div className="flex flex-col gap-0.5 pt-[9px]">
          <p className="text-[12px] leading-[18px] tracking-[-0.1px] text-black">
            From. <span className="font-bold">{from}</span>
          </p>
          <span
            className="w-fit rounded-sm px-[5px] py-px text-[10px] leading-[14px]"
            style={{ backgroundColor: tagColor, color: tagTextColor }}
          >
            {tag}
          </span>
        </div>
      </div>
      <p className="mt-[15px] h-[54px] overflow-hidden text-[12px] leading-[18px] tracking-[-0.1px] text-gray-500">
        {message}
      </p>
      <p className="mt-2 text-[10px] leading-[13px] text-[#777777]">{date}</p>
    </article>
  );
}
