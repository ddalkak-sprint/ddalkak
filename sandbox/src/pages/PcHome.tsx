import HomeButton from "../components/HomeButton";
import FeaturePoint from "../components/FeaturePoint";
import MessageCard from "../components/MessageCard";
import ReactionChip from "../components/ReactionChip";
import EmojiPickerChip from "../components/EmojiPickerChip";
import logoIcon from "../assets/pc-home/logo_icon_color.svg";
import plusIcon from "../assets/pc-home/group_25.svg";
import cursorImg from "../assets/pc-home/image_54.png";
import arrowRightIcon from "../assets/pc-home/ic_arrow_right.svg";
import emojiAddIcon from "../assets/pc-home/emoji_add_icon.svg";

export default function PcHome() {
  return (
    <div className="min-h-screen bg-white font-pretendard">
      {/* header (semanticRole: nav) — line 노드는 border-b로 */}
      <header className="border-b border-[#EDEDED] bg-white">
        <div className="mx-auto flex h-16 w-[1146px] items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoIcon} alt="Rolling 로고" width={28} height={28} />
            <span className="font-poppins text-[20px] font-bold text-gray-90">Rolling</span>
          </div>
          <HomeButton variant="outlined" size={40} label="롤링 페이퍼 만들기" />
        </div>
      </header>

      <main className="mx-auto mt-[60px] flex w-[1200px] flex-col gap-[30px]">
        {/* 섹션 1 — Point. 01 + 메시지 카드 일러스트 (절대배치) */}
        <section className="relative h-[324px] overflow-hidden rounded-2xl bg-surface-home">
          <div className="absolute left-[60px] top-[60px] w-[268px]">
            <FeaturePoint
              point="Point. 01"
              heading="누구나 손쉽게, 온라인 롤링 페이퍼를 만들 수 있어요"
              subtitle="로그인 없이 자유롭게 만들어요."
            />
          </div>
          {/* 카드 목록 — 브릿지 bbox는 겹침으로 기록됐으나 스크린샷 기준 나란히 배열 (스크린샷 우선) */}
          <div className="absolute left-[480px] top-[81px] flex items-start gap-3">
            <MessageCard
              from="강미나"
              tag="친구"
              tagColor="#E2F5FF"
              tagTextColor="#00A2FE"
              message="코로나가 또다시 기승을 부리는 요즘이네요. 건강, 체력 모두 조심 또 하세요!"
              date="2023.07.08"
            />
            <MessageCard
              from="박대영"
              tag="동료"
              tagColor="#ECD9FF"
              tagTextColor="#861DEE"
              message="일교차가 큰 시기입니다. 새벽에는 겨울, 한낮에는 여름, 아침저녁으로는 가을을 느껴보는 것도 좋을 것 같아요. 일교차가 큰 시기입니다. 새벽에는 겨울, 한낮에는 여름, 아침저녁으로는 가을을 느껴보는 것도 좋을 것 같아요. "
              date="2023.07.08"
            />
            {/* add-card — 일러스트 구성물 */}
            <div className="relative h-[162px] w-[205px] rounded-[14px] border border-black/40 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]">
              <img src={plusIcon} alt="" width={38} height={38} className="absolute left-[84px] top-[57px]" />
              <img src={cursorImg} alt="" width={33} height={33} className="absolute left-[125px] top-[63px]" />
            </div>
          </div>
        </section>

        {/* 섹션 2 — 이모지 위젯 일러스트 (절대배치) + Point. 02 */}
        <section className="relative h-[324px] overflow-hidden rounded-2xl bg-surface-home">
          <div className="absolute left-0 top-[60px] h-[204px] w-[720px]">
            <div className="absolute left-[183px] top-[20px] flex items-start gap-[2px]">
              <ReactionChip emoji="👍" count="10" />
              <ReactionChip count="24" />
              <ReactionChip emoji="😍" count="24" />
              <span className="flex h-[33px] w-[33px] items-center justify-center">
                <img src={arrowRightIcon} alt="" width={15} height={15} />
              </span>
            </div>
            <div className="absolute left-[387px] top-[20px] flex h-[33px] items-center gap-1 rounded-[100px] border border-[#DADCDF] px-4 py-1.5">
              <img src={emojiAddIcon} alt="" width={22} height={22} />
              <span className="text-[15px] font-medium leading-[22px] text-black">추가</span>
            </div>
            <div className="absolute left-[127px] top-[61px] flex w-[293px] flex-col items-start gap-3 rounded-[10px] border border-black/30 bg-white p-[30px] shadow-[0_2px_7px_rgba(0,0,0,0.08)]">
              <div className="flex gap-3">
                <EmojiPickerChip emoji="👍" count="24" />
                <EmojiPickerChip emoji="😍" count="12" />
                <EmojiPickerChip emoji="🎉" count="24" />
              </div>
              <div className="flex gap-3">
                <EmojiPickerChip emoji="🥺" count="10" overlay={50} />
                <EmojiPickerChip emoji="🥳" count="8" overlay={50} />
                <EmojiPickerChip emoji="👏" count="10" overlay={50} />
              </div>
            </div>
            <img src={cursorImg} alt="" width={33} height={33} className="absolute left-[498px] top-[10px]" />
          </div>
          <div className="absolute left-[720px] top-[60px] w-[288px]">
            <FeaturePoint
              point="Point. 02"
              heading="서로에게 이모지로 감정을 표현해보세요"
              subtitle="롤링 페이퍼에 이모지를 추가할 수 있어요."
            />
          </div>
        </section>

        {/* 하단 CTA (semanticRole: cta-button) — 브릿지 bbox는 x102이나 스크린샷 기준 중앙 정렬 (스크린샷 우선) */}
        <div className="mb-[150px] mt-[-6px] flex justify-center pt-[24px]">
          <HomeButton variant="primary" size={56} label="구경해보기" className="w-[280px]" />
        </div>
      </main>
    </div>
  );
}
