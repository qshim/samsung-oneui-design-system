import Link from "next/link";
import PageShell from "../components/layout/PageShell";

export default function HomePage() {
  return (
    <PageShell
      title="Samsung One UI Prototype"
    >
      <div className="page-grid">
        <Link className="page-card" href="/prototype">
          <span className="page-card-kicker">Prototype</span>
          <strong>MLP Prototype</strong>
          <p>카드 시나리오와 MLP 타일을 React 컴포넌트로 정리한 프로토타입 페이지입니다.</p>
        </Link>

        <a className="page-card" href="/theme">
          <span className="page-card-kicker">Theme</span>
          <strong>Theme Customizer</strong>
          <p>테마 프리셋 조회, 활성화, 프리뷰를 현재 구조에 맞게 유지하는 페이지입니다.</p>
        </a>
      </div>
    </PageShell>
  );
}
