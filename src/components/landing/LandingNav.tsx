import Link from "next/link";

export function LandingNav() {
  return (
    <div className="nav-wrap">
      <nav className="wrap nav">
        <a className="logo" href="#top">formlq</a>
        <ul>
          <li><a href="#tests">Тести</a></li>
          <li><a href="#board">Дошка</a></li>
          <li><a href="#how">Як це працює</a></li>
          <li><a href="#faq">Питання</a></li>
        </ul>
        <div className="nav-actions">
          <Link className="btn ghost sm" href="/login">Увійти</Link>
          <Link className="btn sm nav-reg" href="/register">Реєстрація</Link>
        </div>
      </nav>
    </div>
  );
}
