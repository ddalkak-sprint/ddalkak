import Button from "../components/Button";
import TextField from "../components/TextField";
import logo from "../assets/login-page/logo.svg";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <section className="flex w-[400px] flex-col gap-6 rounded-xl bg-surface p-10 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <img src={logo} alt="logo" width={48} height={48} />
        <div className="flex flex-col gap-2">
          <h1 className="text-heading-lg font-bold text-text-strong">다시 만나서 반가워요</h1>
          <p className="text-body-md text-text-muted">계정에 로그인하고 계속하세요</p>
        </div>
        <TextField label="이메일" type="email" placeholder="you@example.com" />
        <TextField label="비밀번호" type="password" placeholder="••••••••" />
        <Button label="로그인" />
        <p className="flex justify-center gap-1 text-label-sm">
          <span className="text-text-muted">아직 계정이 없나요?</span>
          {/* 의도적 불일치 #2 (verify 테스트용): 스펙은 primary 색, 구현은 text-muted */}
          <a href="#" className="font-medium text-text-muted">회원가입</a>
        </p>
      </section>
    </main>
  );
}
