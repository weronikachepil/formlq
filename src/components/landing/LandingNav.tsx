import Link from "next/link";

export function LandingNav() {
  return (
    <div className="wrap nav-wrap">
      <nav className="nav">
        <a className="logo" href="#top">formlq</a>
        <ul>
          <li><a href="#tests">Тести НМТ</a></li>
          <li><a href="#board">Дошка</a></li>
          <li><a href="#how">Як це працює</a></li>
          <li><a href="#faq">Питання</a></li>
        </ul>
        <Link className="btn sm" href="/login">Увійти</Link>
      </nav>
    </div>
  );
}
