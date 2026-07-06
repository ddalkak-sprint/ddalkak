import LoginPage from "./pages/LoginPage";
import PcHome from "./pages/PcHome";

export default function App() {
  // 렌더 확인용 간이 전환: http://localhost:5173/#pc-home
  return window.location.hash === "#pc-home" ? <PcHome /> : <LoginPage />;
}
