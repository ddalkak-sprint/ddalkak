const imgIcAdd24 = "https://www.figma.com/api/mcp/asset/eb9bc2c2-a9e4-434d-882c-9a1d832071b5";
const imgIcArrowDown = "https://www.figma.com/api/mcp/asset/fadf4529-a88b-49a5-8042-f27981350d88";
const imgImg = "https://www.figma.com/api/mcp/asset/a7f32f8f-ffba-449e-9e59-e43fe4983e45";
const imgIcAdd25 = "https://www.figma.com/api/mcp/asset/623974e9-9e19-4b36-899e-3dc2c475bc94";
const imgArchesNationalParkGabc4Bf2Ae19201 = "https://www.figma.com/api/mcp/asset/926fb647-e157-44cf-8849-2dc3cdd736b3";
const imgImage42 = "https://www.figma.com/api/mcp/asset/c28e6929-b42b-45c9-9c12-bb348938d6d4";
const imgImage43 = "https://www.figma.com/api/mcp/asset/f4f5489e-cfb8-42ad-aa51-0310088cb043";
const imgIcAdd26 = "https://www.figma.com/api/mcp/asset/b9a7a969-61e7-4d21-80fa-583c102495a7";
const imgIconColor = "https://www.figma.com/api/mcp/asset/619d1daa-1652-45ef-8b91-c44eaf41633e";
const imgEllipse13 = "https://www.figma.com/api/mcp/asset/29385f99-6cb5-48ab-aa77-a35daba31e77";

function IcAdd24({ className }) {
  return (
    <div className={className || "relative size-[24px]"} data-node-id="1:51" data-name="ic / add-24">
      <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd24} />
    </div>
  );
}

function IcArrowDown({ className }) {
  return (
    <div className={className || "relative size-[24px]"} data-node-id="1:174" data-name="ic / arrow_down">
      <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcArrowDown} />
    </div>
  );
}

function Badge({ className, badge = "other" }) {
  const isOther = badge === "other";
  return (
    <div className={className || `content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] ${isOther ? "bg-[#fff0d6]" : "bg-[#f8f0ff]"}`} id={isOther ? "node-1_27" : "node-1_25"}>
      <p className={`[word-break:break-word] font-["Pretendard:Regular"] leading-[20px] not-italic relative shrink-0 text-[14px] tracking-[-0.07px] whitespace-nowrap ${isOther ? "text-[#ff8832]" : "text-[#9935ff]"}`} id={isOther ? "node-1_28" : "node-1_26"}>
        {badge === "coworker" ? "동료" : "지인"}
      </p>
    </div>
  );
}

function Component1({ className, property1 = "img_profile_01" }) {
  return (
    <div className={className || "bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] size-[56px]"} data-node-id="1:9">
      <div className="absolute left-[-32px] size-[108px] top-[-30px]" data-node-id="1:10" data-name="img">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImg} />
      </div>
    </div>
  );
}

function Card({ className, type = "Edit" }) {
  return (
    <div className={className || "bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] relative rounded-[16px] w-[384px]"} data-node-id="1:108">
      <p className="[word-break:break-word] absolute bottom-[42px] font-['Pretendard:Regular'] leading-[18px] left-[24px] not-italic text-[#999] text-[12px] tracking-[-0.06px] translate-y-full whitespace-nowrap" data-node-id="1:109">
        2023.07.08
      </p>
      <div className="[word-break:break-word] absolute font-['Pretendard:Regular'] inset-[116px_24px_58px_24px] leading-[0] not-italic overflow-hidden text-[#4a4a4a] text-[18px] text-ellipsis tracking-[-0.18px]" data-node-id="1:110">
        <p className="leading-[28px] mb-0">코로나가 또다시 기승을 부리는 요즘이네요.</p>
        <p className="leading-[28px]">건강, 체력 모두 조심 또 하세요!</p>
      </div>
      <div className="absolute h-[100px] left-0 right-0 top-0" data-node-id="1:111" data-name="top">
        <div className="absolute content-stretch flex gap-[14px] items-start left-[24px] top-[28px]" data-node-id="1:112">
          <Component1 className="bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] shrink-0 size-[56px]" />
          <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-node-id="1:114">
            <div className="[word-break:break-word] content-stretch flex gap-[6px] items-start leading-[24px] not-italic relative shrink-0 text-[20px] text-black whitespace-nowrap" data-node-id="1:115" data-name="title">
              <p className="font-['Pretendard:Regular'] relative shrink-0" data-node-id="1:116">From.</p>
              <p className="font-['Pretendard:Bold'] relative shrink-0" data-node-id="1:117">김동훈</p>
            </div>
            <Badge badge="coworker" className="bg-[#f8f0ff] content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] shrink-0" />
          </div>
        </div>
        <div className="absolute bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center p-[8px] right-[24px] rounded-[6px] top-[28px]" data-node-id="1:119" data-name="Button / Outlined-40-icon">
          <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0" data-node-id="I1:119;1:1521">
            <div className="relative shrink-0 size-[24px]" data-node-id="I1:119;1:1522" data-name="ic / add-24">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd25} />
            </div>
          </div>
        </div>
        <div className="absolute bg-[#eee] bottom-0 h-px left-[24px] right-[24px]" data-node-id="1:120" data-name="div" />
      </div>
    </div>
  );
}

export default function PcPostIdEditImageCase() {
  return (
    <div className="relative size-full" data-node-id="1:858" data-name="[PC] /post/{id}/edit  (image case)">
      <div className="absolute h-[928px] left-0 overflow-clip top-[132px] w-[1920px]" data-node-id="1:859">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[1359.917px] left-1/2 top-[calc(50%-0.04px)] w-[1920px]" data-node-id="1:860" data-name="arches-national-park-gabc4bf2ae_1920 1">
          <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgArchesNationalParkGabc4Bf2Ae19201} />
        </div>
        <div className="absolute bg-[rgba(0,0,0,0.5)] h-[926px] left-0 top-[2px] w-[1920px]" data-node-id="1:861" data-name="overlay" />
      </div>
      <Card className="absolute bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] left-[calc(66.67%-104px)] rounded-[16px] top-[554px] w-[384px]" data-node-id="1:862" />
      <div className="absolute bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] left-[calc(33.33%+128px)] rounded-[16px] top-[246px] w-[384px]" data-node-id="1:863" data-name="card">
        <p className="[word-break:break-word] absolute bottom-[42px] font-['Pretendard:Regular'] leading-[18px] left-[24px] not-italic text-[#999] text-[12px] tracking-[-0.06px] translate-y-full whitespace-nowrap" data-node-id="I1:863;1:849">2023.07.08</p>
        <div className="[word-break:break-word] absolute font-['Pretendard:Regular'] inset-[116px_24px_58px_24px] leading-[0] not-italic overflow-hidden text-[#4a4a4a] text-[18px] text-ellipsis tracking-[-0.18px]" data-node-id="I1:863;1:850">
          <p className="leading-[28px] mb-0">코로나가 또다시 기승을 부리는 요즘이네요.</p>
          <p className="leading-[28px]">건강, 체력 모두 조심 또 하세요!</p>
        </div>
        <div className="absolute h-[100px] left-0 right-0 top-0" data-node-id="I1:863;1:851" data-name="top">
          <div className="absolute content-stretch flex gap-[14px] items-start left-[24px] top-[28px]" data-node-id="I1:863;1:853">
            <Component1 className="bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] shrink-0 size-[56px]" />
            <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-node-id="I1:863;1:855">
              <div className="[word-break:break-word] content-stretch flex gap-[6px] items-start leading-[24px] not-italic relative shrink-0 text-[20px] text-black whitespace-nowrap" data-node-id="I1:863;1:856" data-name="title">
                <p className="font-['Pretendard:Regular'] relative shrink-0" data-node-id="I1:863;1:857">From.</p>
                <p className="font-['Pretendard:Bold'] relative shrink-0" data-node-id="I1:863;1:858">김동훈</p>
              </div>
              <div className="bg-[#e4fbdc] content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] shrink-0" data-node-id="I1:863;1:859" data-name="badge">
                <p className="[word-break:break-word] font-['Pretendard:Regular'] leading-[20px] not-italic relative shrink-0 text-[#2ba600] text-[14px] tracking-[-0.07px] whitespace-nowrap" data-node-id="I1:863;1:859;1:1645">가족</p>
              </div>
            </div>
          </div>
          <div className="absolute bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center p-[8px] right-[24px] rounded-[6px] top-[28px]" data-node-id="I1:863;1:860" data-name="Button / Outlined-40-icon">
            <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0" data-node-id="I1:863;1:860;1:1521">
              <div className="relative shrink-0 size-[24px]" data-node-id="I1:863;1:860;1:1522" data-name="ic / add-24">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd25} />
              </div>
            </div>
          </div>
          <div className="absolute bg-[#eee] bottom-0 h-px left-[24px] right-[24px]" data-node-id="I1:863;1:861" data-name="div" />
        </div>
      </div>
      <div className="absolute bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] left-[360px] rounded-[16px] top-[246px] w-[384px]" data-node-id="1:864" data-name="card">
        <p className="[word-break:break-word] absolute bottom-[42px] font-['Pretendard:Regular'] leading-[18px] left-[24px] not-italic text-[#999] text-[12px] tracking-[-0.06px] translate-y-full whitespace-nowrap" data-node-id="I1:864;1:849">2023.07.08</p>
        <div className="[word-break:break-word] absolute font-['Pretendard:Regular'] inset-[116px_24px_58px_24px] leading-[0] not-italic overflow-hidden text-[#4a4a4a] text-[18px] text-ellipsis tracking-[-0.18px]" data-node-id="I1:864;1:850">
          <p className="leading-[28px] mb-0">코로나가 또다시 기승을 부리는 요즘이네요.</p>
          <p className="leading-[28px]">건강, 체력 모두 조심 또 하세요!</p>
        </div>
        <div className="absolute h-[100px] left-0 right-0 top-0" data-node-id="I1:864;1:851" data-name="top">
          <div className="absolute content-stretch flex gap-[14px] items-start left-[24px] top-[28px]" data-node-id="I1:864;1:853">
            <Component1 className="bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] shrink-0 size-[56px]" />
            <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-node-id="I1:864;1:855">
              <div className="[word-break:break-word] content-stretch flex gap-[6px] items-start leading-[24px] not-italic relative shrink-0 text-[20px] text-black whitespace-nowrap" data-node-id="I1:864;1:856" data-name="title">
                <p className="font-['Pretendard:Regular'] relative shrink-0" data-node-id="I1:864;1:857">From.</p>
                <p className="font-['Pretendard:Bold'] relative shrink-0" data-node-id="I1:864;1:858">김동훈</p>
              </div>
              <div className="bg-[#e4fbdc] content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] shrink-0" data-node-id="I1:864;1:859" data-name="badge">
                <p className="[word-break:break-word] font-['Pretendard:Regular'] leading-[20px] not-italic relative shrink-0 text-[#2ba600] text-[14px] tracking-[-0.07px] whitespace-nowrap" data-node-id="I1:864;1:859;1:1645">가족</p>
              </div>
            </div>
          </div>
          <div className="absolute bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center p-[8px] right-[24px] rounded-[6px] top-[28px]" data-node-id="I1:864;1:860" data-name="Button / Outlined-40-icon">
            <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0" data-node-id="I1:864;1:860;1:1521">
              <div className="relative shrink-0 size-[24px]" data-node-id="I1:864;1:860;1:1522" data-name="ic / add-24">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd25} />
              </div>
            </div>
          </div>
          <div className="absolute bg-[#eee] bottom-0 h-px left-[24px] right-[24px]" data-node-id="I1:864;1:861" data-name="div" />
        </div>
      </div>
      <div className="absolute bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] left-[360px] rounded-[16px] top-[554px] w-[384px]" data-node-id="1:865" data-name="card">
        <p className="[word-break:break-word] absolute bottom-[42px] font-['Pretendard:Regular'] leading-[18px] left-[24px] not-italic text-[#999] text-[12px] tracking-[-0.06px] translate-y-full whitespace-nowrap" data-node-id="I1:865;1:849">2023.07.08</p>
        <p className="[word-break:break-word] absolute font-['Pretendard:Regular'] inset-[116px_24px_58px_24px] leading-[28px] not-italic overflow-hidden text-[#4a4a4a] text-[18px] text-ellipsis tracking-[-0.18px]" data-node-id="I1:865;1:850">1년의 한번 생일 정말 축하드립니다. 생일기념 롤링 페이퍼를 준비 했습니다! 생일 진심으로 축하드립니다 이날은 애슐리님이 주인공입니다✌️</p>
        <div className="absolute h-[100px] left-0 right-0 top-0" data-node-id="I1:865;1:851" data-name="top">
          <div className="absolute content-stretch flex gap-[14px] items-start left-[24px] top-[28px]" data-node-id="I1:865;1:853">
            <div className="bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] shrink-0 size-[56px]" data-node-id="I1:865;1:854" data-name="Component 1">
              <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[64px] left-[calc(50%-6px)] top-[calc(50%+4px)] w-[84px]" data-node-id="I1:865;1:854;1:638" data-name="image 42">
                <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage42} />
              </div>
            </div>
            <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-node-id="I1:865;1:855">
              <div className="[word-break:break-word] content-stretch flex gap-[6px] items-start leading-[24px] not-italic relative shrink-0 text-[20px] text-black whitespace-nowrap" data-node-id="I1:865;1:856" data-name="title">
                <p className="font-['Pretendard:Regular'] relative shrink-0" data-node-id="I1:865;1:857">From.</p>
                <p className="font-['Pretendard:Bold'] relative shrink-0" data-node-id="I1:865;1:858">강미나</p>
              </div>
              <div className="bg-[#e2f5ff] content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] shrink-0" data-node-id="I1:865;1:859" data-name="badge">
                <p className="[word-break:break-word] font-['Pretendard:Regular'] leading-[20px] not-italic relative shrink-0 text-[#00a2fe] text-[14px] tracking-[-0.07px] whitespace-nowrap" data-node-id="I1:865;1:859;1:1647">친구</p>
              </div>
            </div>
          </div>
          <div className="absolute bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center p-[8px] right-[24px] rounded-[6px] top-[28px]" data-node-id="I1:865;1:860" data-name="Button / Outlined-40-icon">
            <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0" data-node-id="I1:865;1:860;1:1521">
              <div className="relative shrink-0 size-[24px]" data-node-id="I1:865;1:860;1:1522" data-name="ic / add-24">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd26} />
              </div>
            </div>
          </div>
          <div className="absolute bg-[#eee] bottom-0 h-px left-[24px] right-[24px]" data-node-id="I1:865;1:861" data-name="div" />
        </div>
      </div>
      <div className="absolute bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] left-[calc(33.33%+128px)] rounded-[16px] top-[554px] w-[384px]" data-node-id="1:866" data-name="card">
        <p className="[word-break:break-word] absolute bottom-[42px] font-['Pretendard:Regular'] leading-[18px] left-[24px] not-italic text-[#999] text-[12px] tracking-[-0.06px] translate-y-full whitespace-nowrap" data-node-id="I1:866;1:849">2023.07.08</p>
        <p className="[word-break:break-word] absolute font-['Pretendard:Regular'] inset-[116px_24px_58px_24px] leading-[28px] not-italic overflow-hidden text-[#4a4a4a] text-[18px] text-ellipsis tracking-[-0.18px]" data-node-id="I1:866;1:850">일교차가 큰 시기입니다. 새벽에는 겨울, 한낮에는 여름, 아침저녁으로는 가을을 느껴보는 것도 좋을 것 같아요. 일교차가 큰 시기입니다. 새벽에는 겨울, 한낮에는 여름, 아침저녁으로는 가을을 느껴보는 것도 좋은</p>
        <div className="absolute h-[100px] left-0 right-0 top-0" data-node-id="I1:866;1:851" data-name="top">
          <div className="absolute content-stretch flex gap-[14px] items-start left-[24px] top-[28px]" data-node-id="I1:866;1:853">
            <Component1 className="bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] shrink-0 size-[56px]" />
            <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-node-id="I1:866;1:855">
              <div className="[word-break:break-word] content-stretch flex gap-[6px] items-start leading-[24px] not-italic relative shrink-0 text-[20px] text-black whitespace-nowrap" data-node-id="I1:866;1:856" data-name="title">
                <p className="font-['Pretendard:Regular'] relative shrink-0" data-node-id="I1:866;1:857">From.</p>
                <p className="font-['Pretendard:Bold'] relative shrink-0" data-node-id="I1:866;1:858">김동훈</p>
              </div>
              <div className="bg-[#fff0d6] content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] shrink-0" data-node-id="I1:866;1:859" data-name="badge">
                <p className="[word-break:break-word] font-['Pretendard:Regular'] leading-[20px] not-italic relative shrink-0 text-[#ff8832] text-[14px] tracking-[-0.07px] whitespace-nowrap" data-node-id="I1:866;1:859;1:1643">지인</p>
              </div>
            </div>
          </div>
          <div className="absolute bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center p-[8px] right-[24px] rounded-[6px] top-[28px]" data-node-id="I1:866;1:860" data-name="Button / Outlined-40-icon">
            <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0" data-node-id="I1:866;1:860;1:1521">
              <div className="relative shrink-0 size-[24px]" data-node-id="I1:866;1:860;1:1522" data-name="ic / add-24">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd26} />
              </div>
            </div>
          </div>
          <div className="absolute bg-[#eee] bottom-0 h-px left-[24px] right-[24px]" data-node-id="I1:866;1:861" data-name="div" />
        </div>
      </div>
      <div className="absolute bg-white drop-shadow-[0px_2px_6px_rgba(0,0,0,0.08)] h-[280px] left-[calc(66.67%-104px)] rounded-[16px] top-[246px] w-[384px]" data-node-id="1:867" data-name="card">
        <p className="[word-break:break-word] absolute bottom-[42px] font-['Pretendard:Regular'] leading-[18px] left-[24px] not-italic text-[#999] text-[12px] tracking-[-0.06px] translate-y-full whitespace-nowrap" data-node-id="I1:867;1:849">2023.07.08</p>
        <div className="[word-break:break-word] absolute font-['Pretendard:Regular'] inset-[116px_24px_58px_24px] leading-[0] not-italic overflow-hidden text-[#4a4a4a] text-[18px] text-ellipsis tracking-[-0.18px]" data-node-id="I1:867;1:850">
          <p className="leading-[28px] mb-0">코로나가 또다시 기승을 부리는 요즘이네요.</p>
          <p className="leading-[28px]">건강, 체력 모두 조심 또 하세요!</p>
        </div>
        <div className="absolute h-[100px] left-0 right-0 top-0" data-node-id="I1:867;1:851" data-name="top">
          <div className="absolute content-stretch flex gap-[14px] items-start left-[24px] top-[28px]" data-node-id="I1:867;1:853">
            <div className="bg-white border border-[#eee] border-solid overflow-clip relative rounded-[100px] shrink-0 size-[56px]" data-node-id="I1:867;1:854" data-name="Component 1">
              <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[96px] left-[calc(50%-2px)] top-[calc(50%+10px)] w-[64px]" data-node-id="I1:867;1:854;1:640" data-name="image 43">
                <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage43} />
              </div>
            </div>
            <div className="content-stretch flex flex-col gap-[6px] items-start relative shrink-0" data-node-id="I1:867;1:855">
              <div className="[word-break:break-word] content-stretch flex gap-[6px] items-start leading-[24px] not-italic relative shrink-0 text-[20px] text-black whitespace-nowrap" data-node-id="I1:867;1:856" data-name="title">
                <p className="font-['Pretendard:Regular'] relative shrink-0" data-node-id="I1:867;1:857">From.</p>
                <p className="font-['Pretendard:Bold'] relative shrink-0" data-node-id="I1:867;1:858">김동훈</p>
              </div>
              <Badge badge="coworker" className="bg-[#f8f0ff] content-stretch flex items-center justify-center px-[8px] relative rounded-[4px] shrink-0" />
            </div>
          </div>
          <div className="absolute bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center p-[8px] right-[24px] rounded-[6px] top-[28px]" data-node-id="I1:867;1:860" data-name="Button / Outlined-40-icon">
            <div className="content-stretch flex gap-[10px] items-center justify-center relative shrink-0" data-node-id="I1:867;1:860;1:1521">
              <div className="relative shrink-0 size-[24px]" data-node-id="I1:867;1:860;1:1522" data-name="ic / add-24">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd26} />
              </div>
            </div>
          </div>
          <div className="absolute bg-[#eee] bottom-0 h-px left-[24px] right-[24px]" data-node-id="I1:867;1:861" data-name="div" />
        </div>
      </div>
      <div className="absolute h-[65px] left-0 top-0 w-[1920px]" data-node-id="1:868" data-name="header">
        <div className="-translate-y-1/2 absolute bg-white content-stretch flex items-center left-0 px-[360px] py-[11px] right-0 top-[calc(50%-0.5px)]" data-node-id="I1:868;1:642" data-name="header">
          <div className="content-stretch flex gap-[944px] items-center relative shrink-0" data-node-id="I1:868;1:643">
            <div className="h-[42px] relative shrink-0 w-[106px]" data-node-id="I1:868;1:644" data-name="logo">
              <div className="-translate-y-1/2 absolute content-stretch flex gap-[8px] items-center left-0 top-1/2" data-node-id="I1:868;1:645">
                <div className="h-[27.658px] relative shrink-0 w-[27.818px]" data-node-id="I1:868;1:646" data-name="🎨 Icon Color">
                  <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIconColor} />
                </div>
                <div className="[word-break:break-word] flex flex-col font-['Poppins:Bold'] justify-center leading-[0] not-italic relative shrink-0 text-[#4a494f] text-[19.971px] text-center whitespace-nowrap" data-node-id="I1:868;1:647">
                  <p className="leading-[normal]">Rolling</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bg-[#ededed] bottom-0 h-px left-0 right-0" data-node-id="I1:868;1:649" data-name="line" />
      </div>
      <div className="absolute h-[68px] left-0 top-[65px] w-[1920px]" data-node-id="1:869" data-name="header_service">
        <div className="-translate-x-1/2 -translate-y-1/2 absolute bg-white content-stretch flex items-center left-1/2 px-[360px] py-[13px] top-1/2" data-node-id="I1:869;1:651" data-name="header_service">
          <div className="content-stretch flex gap-[263px] items-center relative shrink-0" data-node-id="I1:869;1:651;291:26004">
            <p className="[word-break:break-word] font-['Pretendard:Bold'] leading-[42px] not-italic relative shrink-0 text-[#2b2b2b] text-[28px] tracking-[-0.28px] w-[227px]" data-node-id="I1:869;1:651;291:26005">To. Ashley Kim</p>
            <div className="content-stretch flex gap-[28px] items-center relative shrink-0" data-node-id="I1:869;1:651;291:26006">
              <div className="content-stretch flex gap-[11px] items-end leading-[0] relative shrink-0" data-node-id="I1:869;1:651;291:26007">
                <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid place-items-start relative shrink-0" data-node-id="I1:869;1:651;291:26008">
                  <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-0 mt-0 place-items-start relative row-1" data-node-id="I1:869;1:651;291:26009">
                    <div className="border-[1.4px] border-solid border-white col-1 ml-0 mt-0 overflow-clip relative rounded-[140px] row-1 size-[28px]" data-node-id="I1:869;1:651;291:26010">
                      <div className="absolute left-[-26.4px] size-[70px] top-[-22.4px]" data-node-id="I1:869;1:651;291:26011" data-name="image 45">
                        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImg} />
                      </div>
                    </div>
                  </div>
                  <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[16px] mt-0 place-items-start relative row-1" data-node-id="I1:869;1:651;291:26012">
                    <div className="border-[1.4px] border-solid border-white col-1 ml-0 mt-0 overflow-clip relative rounded-[140px] row-1 size-[28px]" data-node-id="I1:869;1:651;291:26013">
                      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[44.8px] left-[calc(50%-5.6px)] top-[calc(50%+7px)] w-[58.8px]" data-node-id="I1:869;1:651;291:26014" data-name="image 42">
                        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage42} />
                      </div>
                    </div>
                  </div>
                  <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[32px] mt-0 place-items-start relative row-1" data-node-id="I1:869;1:651;291:26015">
                    <div className="border-[1.4px] border-solid border-white col-1 ml-0 mt-0 overflow-clip relative rounded-[140px] row-1 size-[28px]" data-node-id="I1:869;1:651;291:26016">
                      <div className="-translate-x-1/2 -translate-y-1/2 absolute h-[63px] left-[calc(50%-2.8px)] top-[calc(50%+7.7px)] w-[42px]" data-node-id="I1:869;1:651;291:26017" data-name="image 43">
                        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage43} />
                      </div>
                    </div>
                  </div>
                  <div className="col-1 grid-cols-[max-content] grid-rows-[max-content] inline-grid ml-[48px] mt-0 place-items-start relative row-1" data-node-id="I1:869;1:651;291:26018">
                    <div className="col-1 ml-0 mt-0 relative row-1 size-[28px]" data-node-id="I1:869;1:651;291:26019">
                      <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgEllipse13} />
                    </div>
                    <p className="[word-break:break-word] col-1 font-['Pretendard:Medium'] leading-[18px] ml-[6px] mt-[5px] not-italic relative row-1 text-[#484848] text-[12px] whitespace-nowrap" data-node-id="I1:869;1:651;291:26020">+6</p>
                  </div>
                </div>
                <p className="[word-break:break-word] font-['Pretendard:Regular'] not-italic relative shrink-0 text-[#181818] text-[18px] whitespace-nowrap" data-node-id="I1:869;1:651;291:26021">
                  <span className="font-['Pretendard:Bold'] leading-[27px]">9</span>
                  <span className="leading-[27px]">명이 작성했어요!</span>
                </p>
              </div>
              <div className="bg-[#eee] h-[28px] relative shrink-0 w-px" data-node-id="I1:869;1:651;291:26022" />
              <div className="content-stretch flex gap-[8px] items-start relative shrink-0" data-node-id="I1:869;1:651;291:26023">
                <div className="content-stretch flex gap-[2px] items-start relative shrink-0" data-node-id="I1:869;1:651;291:26024">
                  <div className="content-stretch flex items-start relative shrink-0" data-node-id="I1:869;1:651;291:26025">
                    <div className="content-stretch flex gap-[8px] items-start relative shrink-0" data-node-id="I1:869;1:651;291:26026">
                      <div className="bg-[rgba(0,0,0,0.54)] content-stretch flex flex-col items-start px-[12px] py-[8px] relative rounded-[32px] shrink-0" data-node-id="I1:869;1:651;291:26027" data-name="badge_emoji">
                        <div className="content-stretch flex gap-[2px] items-center relative shrink-0" data-node-id="I1:869;1:651;291:26027;1:1649" data-name="badge_emoji">
                          <div className="overflow-clip relative shrink-0 size-[20px]" data-node-id="I1:869;1:651;291:26027;1:1650" data-name="ic / emoji">
                            <div className="-translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Pretendard:Regular'] justify-center leading-[0] left-[calc(50%-8px)] not-italic text-[16px] text-black top-[calc(50%-0.5px)] whitespace-nowrap" data-node-id="I1:869;1:651;291:26027;1:1651">
                              <p className="leading-[21px]">👍</p>
                            </div>
                          </div>
                          <div className="[word-break:break-word] flex flex-col font-['Pretendard:Regular'] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-white whitespace-nowrap" data-node-id="I1:869;1:651;291:26027;1:1652">
                            <p className="leading-[20px]">24</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-[rgba(0,0,0,0.54)] content-stretch flex flex-col items-start px-[12px] py-[8px] relative rounded-[32px] shrink-0" data-node-id="I1:869;1:651;291:26028" data-name="badge_emoji">
                        <div className="content-stretch flex gap-[2px] items-center relative shrink-0" data-node-id="I1:869;1:651;291:26028;1:1649" data-name="badge_emoji">
                          <div className="overflow-clip relative shrink-0 size-[20px]" data-node-id="I1:869;1:651;291:26028;1:1650" data-name="ic / emoji">
                            <div className="-translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Pretendard:Regular'] justify-center leading-[0] left-[calc(50%-8px)] not-italic text-[16px] text-black top-[calc(50%-0.5px)] whitespace-nowrap" data-node-id="I1:869;1:651;291:26028;1:1651">
                              <p className="leading-[21px]">😍</p>
                            </div>
                          </div>
                          <div className="[word-break:break-word] flex flex-col font-['Pretendard:Regular'] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-white whitespace-nowrap" data-node-id="I1:869;1:651;291:26028;1:1652">
                            <p className="leading-[20px]">16</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-[rgba(0,0,0,0.54)] content-stretch flex flex-col items-start px-[12px] py-[8px] relative rounded-[32px] shrink-0" data-node-id="I1:869;1:651;291:26029" data-name="badge_emoji">
                        <div className="content-stretch flex gap-[2px] items-center relative shrink-0" data-node-id="I1:869;1:651;291:26029;1:1649" data-name="badge_emoji">
                          <div className="overflow-clip relative shrink-0 size-[20px]" data-node-id="I1:869;1:651;291:26029;1:1650" data-name="ic / emoji">
                            <div className="-translate-y-1/2 [word-break:break-word] absolute flex flex-col font-['Pretendard:Regular'] justify-center leading-[0] left-[calc(50%-8px)] not-italic text-[16px] text-black top-[calc(50%-0.5px)] tracking-[-0.16px] whitespace-nowrap" data-node-id="I1:869;1:651;291:26029;1:1651">
                              <p className="leading-[26px]">🎉</p>
                            </div>
                          </div>
                          <div className="[word-break:break-word] flex flex-col font-['Pretendard:Regular'] justify-center leading-[0] not-italic relative shrink-0 text-[16px] text-white whitespace-nowrap" data-node-id="I1:869;1:651;291:26029;1:1652">
                            <p className="leading-[20px]">10</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="relative shrink-0 size-[36px]" data-node-id="I1:869;1:651;291:26030" data-name="button">
                    <IcArrowDown className="-translate-x-1/2 -translate-y-1/2 absolute left-1/2 size-[24px] top-1/2" />
                  </div>
                </div>
                <div className="content-stretch flex gap-[13px] items-center relative shrink-0" data-node-id="I1:869;1:651;291:26032">
                  <div className="bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center px-[16px] py-[6px] relative rounded-[6px] shrink-0" data-node-id="I1:869;1:651;291:26033" data-name="Button / Outlined-36-icon">
                    <div className="content-stretch flex gap-[4px] items-center justify-center relative shrink-0" data-node-id="I1:869;1:651;291:26033;1:1559">
                      <IcAdd24 className="relative shrink-0 size-[24px]" />
                      <p className="[word-break:break-word] font-['Pretendard:Medium'] leading-[24px] not-italic relative shrink-0 text-[#181818] text-[16px] whitespace-nowrap" data-node-id="I1:869;1:651;291:26033;1:1561">추가</p>
                    </div>
                  </div>
                  <div className="bg-[#eee] h-[28px] relative shrink-0 w-px" data-node-id="I1:869;1:651;291:26034" />
                  <div className="bg-white border border-[#ccc] border-solid content-stretch flex items-center justify-center px-[16px] py-[6px] relative rounded-[6px] shrink-0" data-node-id="I1:869;1:651;291:26035" data-name="Button / Outlined-36-icon">
                    <div className="content-stretch flex gap-[4px] items-center justify-center relative shrink-0" data-node-id="I1:869;1:651;291:26035;1:1559">
                      <div className="relative shrink-0 size-[24px]" data-node-id="I1:869;1:651;291:26035;1:1560" data-name="ic / add-24">
                        <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgIcAdd26} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bg-[#ededed] bottom-[-1px] h-px left-0 right-0" data-node-id="I1:869;1:652" data-name="line" />
      </div>
    </div>
  );
}
