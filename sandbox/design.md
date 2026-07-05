# design.md — 팀 프론트엔드 컨벤션

> 이 파일은 딸깍 code 단계가 코드를 생성할 때 따르는 규칙이다.
> 샌드박스 기본 베이스(React 웹). 프로젝트에 맞게 수정해서 쓰세요.

## 1. 기술 스택
- Framework: React 18 (Vite)
- Language: TypeScript
- Styling: Tailwind CSS
- 상태관리: 없음 (필요 시 컴포넌트 로컬 state)
- 패키지 매니저: npm

## 2. 디렉토리 구조
```
src/
  components/        # 재사용 컴포넌트 (Button, TextField ...)
    <Component>/
      <Component>.tsx
      index.ts
  pages/             # 화면 단위 컴포넌트 (bridge screen 1개 = page 1개)
  assets/            # 브릿지 assets export 대상
  styles/            # 전역 스타일, 토큰 정의
```

## 3. 네이밍 규칙
- 컴포넌트: PascalCase (`LoginPage`, `TextField`)
- 파일: 컴포넌트 파일은 PascalCase.tsx, 그 외 kebab-case
- 브릿지 screen name(kebab-case) → 페이지 컴포넌트 PascalCase (`login-page` → `LoginPage`)

## 4. 컴포넌트 규칙
- props는 `interface <Component>Props`로 명시, `any` 금지
- 컴포넌트 폴더에 `index.ts` re-export
- 브릿지의 `component` 노드는 `src/components/`의 재사용 컴포넌트로, `group` 노드는 레이아웃 JSX로 대응

## 5. 디자인 토큰 매핑
- 색상 토큰 → `tailwind.config.js` `theme.extend.colors`에 등록 후 유틸 클래스 사용 (`bg-primary`)
- 타이포 → `theme.extend.fontSize` (`text-heading-lg`)
- 간격 → Tailwind 기본 스케일 사용, 브릿지 `spacing` 토큰은 px 값 그대로 매핑 (`gap-[24px]` 또는 확장 등록)
