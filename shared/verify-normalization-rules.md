# verify 정규화 규칙표 (SSOT)

> **이 문서가 verify 정적 검산의 유일한 규칙 원본이다.**
> `scripts/verify-static.mjs`는 이 표와 1:1 대응하도록 구현되며, 규칙 변경은 반드시
> 이 문서 수정 → 스크립트 반영 순서로 진행한다. (시드 seed_f1b060acab4e 제약)
> 원칙: **정규화는 풍부하게, 비교 오차는 0.** 정적 층에는 렌더링 노이즈가 없으므로
> 정규화 후 값 차이는 전부 진짜 오류다. (허용 오차는 v0.2 픽셀 층의 것)
> 지원 스키마: bridge 1.1(목업) / 2.x(figma-extractor) — `meta.schemaVersion`으로 분기.

## 1. 값 정규화

| 대상 | 규칙 | 예 |
|------|------|----|
| hex 색상 | 소문자 통일, 3자리 축약은 6자리로 확장 | `#1A73E8`→`#1a73e8`, `#FFF`→`#ffffff` |
| 색 토큰/참조 | 1.1: bridge `tokens.color` 이름 → hex. 2.x: `@color.xxx` 참조 → tokens에서 복원. 실제값은 tailwind.config `colors` → hex | `@color.primary`→`#3b82f6` |
| lineHeight | 단위 통일: 값이 4 초과면 px로 간주해 fontSize로 나눠 unitless화, 소수 2자리 반올림 | `20px/14px`→`1.43`, `1.3`→`1.3` |
| box-shadow | **양변을 캐논 형태로**: `Xpx Ypx Bpx Spx rgba(r,g,b,a)` (색은 hex8→rgba, alpha 소수 2자리; spread 생략 시 0; 다중 그림자는 ` , ` 연결). Tailwind 임의값 `_`→공백 후 캐논화, `shadow-<tok>`은 config `boxShadow` 값 캐논화, 2.x effect 객체(`{color,offset,radius,spread}`)도 동일 캐논화 | `#00000033`+offset[0,4]+radius 8 ↔ `shadow-elevation`("0 4px 8px rgba(0,0,0,0.2)") |
| padding | **4방향 튜플 `"t r b l"`로 통일** — 1.1 단일값은 4방향 복제, 2.x는 배열 그대로(@ref 해석). 실제값은 `p<px<py<pt/pr/pb/pl` 캐스케이드로 합성(미지정 변 0) | `p-10`→`40 40 40 40` |
| borderRadius | **CSS 클램프 비교**: 노드 bbox(또는 매칭 요소의 환산 가능한 w/h)의 짧은 변 절반을 초과하는 radius는 렌더 동일 → 양변을 `min(r, 짧은변/2)`로 클램프 후 비교. 크기를 모르면 원값 비교 | 4px 높이 dot: 기대 6 ↔ `rounded-full`(9999) = pass |
| fontWeight | 클래스가 요소·조상 어디에도 없으면 CSS 기본값 **400** 으로 간주 | `font-medium` 없음 → 400 |
| flexDirection | `flex-col`→column, `flex-row`→row, `flex`만 있으면 CSS 기본값 **row** (요소·파일 스코프 공통) | |

## 2. Tailwind 클래스 → 값 환산

| 클래스 | 환산 | 비고 |
|--------|------|------|
| `h-N` `w-N` `gap-N` `p*-N` | N × 4px (기본 스케일) | `h-11`=44px, `h-12`=48px, `gap-6`=24px, `p-10`=40px |
| `h-[Npx]` 등 임의값 | N px 그대로 | `w-[400px]`=400px |
| `rounded*` | none 0 / sm 2 / (기본) 4 / md 6 / **lg 8** / **xl 12** / 2xl 16 / 3xl 24 / full 9999 | full은 §1 클램프 규칙과 결합 |
| `bg-<tok>` `text-<tok>` `border-<tok>` | config→bridge 순으로 토큰 해석해 hex. `white`/`black`/`transparent`는 내장값 | `text-dk-red-500`=`#ff0038` |
| `text-[#hex]` 등 색 임의값 | hex 정규화 그대로 | `text-[#999590]` |
| `text-<tok>` (fontSize 토큰이면) | config `fontSize`에서 size+lineHeight | `text-by-03`=14px/1.4 |
| `font-*` | thin 100 … normal 400 / **medium 500** / semibold 600 / **bold 700** … black 900 | |
| `shadow-[…]` / `shadow-<tok>` | §1 box-shadow 캐논화 | |
| **조건부 클래스(템플릿 className)** | 표현식 안의 모든 문자열 조각을 **후보 집합**으로 수집. 같은 속성 후보가 여러 값이면: 기대값 ∈ 집합 → pass(사유 "조건부 클래스 집합에서 일치"), ∉ → mismatch(집합 전체를 실제값으로 표기) | `${selected ? "text-a" : "text-b"}` |
| 환산 불가 (`h-full`, `w-auto`, 미지 클래스) | **미판정** — verdict `match_failure` + `conversionSuccess:false` + 사유 기록, 런타임/AI 층으로 이관 | 거짓 PASS/MISMATCH 금지 |

`text-*` 접두사는 색·크기 겸용이므로 **config의 colors/fontSize 맵 조회로 구분**한다.

## 3. 체크리스트 출제 범위 (bridge.json → 검사 항목)

**공통**: x/y와 파생 간격은 정적 검산에서 원리적으로 제외 (v0.2 픽셀 층). 비시각 속성
(`componentProps`, `constraints`, `semanticRole` 등) 제외.

**1.1**: `layout`(방향 문자열), `gap`, `style.background/color/border`(색),
`style.borderRadius/padding/height`, `style.shadow`, `style.token`(→fontSize/fontWeight/lineHeight).
bbox는 자체 style 있는 group의 width + image의 width/height.

**2.x**:
- `layout.mode`(column/row)→flexDirection, `layout.gap`→gap, `layout.padding[4]`→padding 튜플 (전부 @ref 해석)
- `style.fills` **단일 solid만** → text 노드는 textColor, 그 외는 backgroundColor (다중/그라디언트/이미지 fill은 정적 출제 범위 밖)
- `style.strokes` 단일 solid → borderColor, `style.cornerRadius`→borderRadius, `style.effects`→boxShadow(§1 캐논)
- text `style.font`(@type 참조 또는 인라인 객체) → fontSize/fontWeight/lineHeight 3항목
- bbox w/h: **`layout.sizing`이 fixed인 축만** 출제 (hug/fill은 파생값). layout 없는 image/vector와 style 있는 shape는 w+h
- `source: "vision"/"inferred"` 노드 유래 항목은 리포트에 저신뢰 표기 (verify 최우선 확인 대상)

**dedup — 같은 실체의 다중 출현은 1항목** (기대값까지 같을 때만 병합, 인스턴스 nodeId 병기):
component류는 (mappedCodeComponent‖suggestedComponent‖componentName), text는 content, 자산 노드는 ref,
그 외는 (타입+노드명) 키. 두 상태 화면(screens[0]/[1])의 공통 요소 이중 감점 방지.

## 4. 매칭 규칙 (노드 ↔ 코드)

1. **1단 — `data-dk="<노드ID>"`** (결정론, confidence high). 노드 ID는 JSON 경로 파생: `screens[0].nodes[0].children[3]`
   - **탐색 범위는 plan 파일 계획의 파일로 한정** — 노드 경로 네임스페이스는 브릿지마다 동일하므로
     다른 화면 파일까지 뒤지면 브릿지 간 data-dk가 충돌한다.
   - 속성값이 표현식이어도 **정적으로 해석**한다: 파일 상단 `const` 문자열/템플릿 테이블 치환,
     삼항(`cond ? A : B`)은 양 분기를 모두 그 요소의 후보 nodeId로 인정. 해석 불가(런타임 인덱스 등)는 매칭 불가.
2. **2단 — 폴백** (confidence low, 리포트에 표시):
   - component/instance/frame에 `mappedCodeComponent` 또는 `suggestedComponent`가 있으면 → 해당 컴포넌트 파일(들) 전체 스코프
     (`src/components/<Name>/` 규약)
   - text → content 문자열을 자신의 텍스트로 가진 요소 (plan 파일 우선, 없으면 src/ 폴백 + 계획 이탈 표기)
   - image/vector → **자산 export 파일명 매칭**: bridge `assets[].export`의 basename ↔ 코드 `import` 문 해석을 통한 `<img src>` 파일명
   - group/frame/instance(컴포넌트 단서 없음) → 자손 text content를 앵커로:
     앵커는 **deepText(자손 포함 텍스트) 포함 + 가장 안쪽 요소**로 특정 (Figma의 한 text 노드가 코드에서 span+a로
     쪼개진 경우 대응). 미발견 앵커는 건너뛰되(그 노드 자체의 체크가 별도로 잡음), **발견 앵커가 2개 미만이면
     미판정** — 앵커 1개의 "가장 안쪽 래퍼"는 컨테이너 오특정의 원천이다.
3. **모호성 = 즉시 match_failure**: 폴백 후보 2개 이상, 앵커 innermost 중복, data-dk 중복 — 임의 선택 금지
   (엉뚱한 요소를 채점하는 오판 원천 차단)
4. 텍스트 속성(fontSize/fontWeight/lineHeight/색)은 요소에 없으면 **같은 파일 조상에서 상속 탐색** (가까운 것 우선)
5. line number는 캐시가 아니라 **검증 실행 시점에 파일을 파싱**해 해당 클래스 토큰의 줄로 계산 (포매팅은 verify 이전 완료 필수)

## 5. 파일 탐색 (주소록 — 판단 근거 아님)

- plan.md `## 파일 계획` 표의 경로가 1차 대상. **채점 기준은 끝까지 bridge.json 단독**
- 대상에서 못 찾으면 `src/` 재귀 폴백 스캔 → 발견 시 리포트에 "계획 이탈" 표기 (단 data-dk는 §4-1 한정 규칙 적용)

## 6. 판정·점수

- 항목 판정 3-상태: `pass` / `mismatch` / `match_failure` — 조용한 누락 구조적 금지
- 리포트 판정: **mismatch 0 AND match_failure 0 일 때만 PASS**, 아니면 FAIL
- 점수 분모는 **항상 전체 항목 수** (매칭 실패도 감점)
- v0.1 리포트의 주장 범위는 **"스펙(bridge.json) 일치"** — "Figma 일치"는 v0.2(픽셀 층)부터
- `verify.json`이 단일 정본이고 `verify.md`는 그것의 렌더링 (독립 판정 로직 금지)
- 요약에 매칭 통계(data-dk/폴백/저신뢰 건수)를 병기 — data-dk 채택률이 올라갈수록 매칭 신뢰도가 결정론으로 승격된다
- **data-dk는 매칭 도구이지 감사 대상이 아니다.** 부착 여부 자체를 PASS/FAIL 게이트로 삼지 않는다 — "data-dk 누락"은 목적이 아니라 수단을 채점하는 것이라 판정 대상에서 제외한다. 앵커가 실제로 필요한 곳은 **폴백이 노드를 특정하지 못하는 경우**(텍스트 앵커 없는 group/frame 등)뿐이고, 그 필요는 이미 `match_failure`로 자연히 드러난다. 따라서 앵커는 전 노드 부착이 아니라 **폴백이 실패하는 노드에만 타깃**으로 요구한다. (근거: 앵커 부착은 생성 시점의 요소↔노드 대응을 아는 생성자만 할 수 있어 프롬프트로 100% 보장이 불가능하다 → 신뢰의 원천은 부착률이 아니라 verify의 정직한 실패 표기 + 수정 루프다.)
