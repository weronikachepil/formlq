import Link from "next/link";
import { BoardMock } from "./BoardMock";

const PILLS = ["Минулі роки НМТ", "Тести від викладачів", "Автоперевірка", "Дошка онлайн"];

export function Hero() {
  return (
    <header className="hero" id="top">
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">Платформа для математики</p>
          <h1>
            Готуйся до НМТ<br />і вчись на <em>дошці</em>
          </h1>
          <p className="lead">
            Тести НМТ минулих років і тести від викладачів з автоперевіркою та розбором — і жива
            математична дошка з графіками, фігурами й формулами, де вчитель та учні працюють разом.
          </p>
          <div className="cta">
            <a className="btn" href="#tests">Розв’язувати тести</a>
            <Link className="btn ghost" href="/register">Відкрити дошку</Link>
          </div>
          <div className="pills">
            {PILLS.map((label) => (
              <span key={label} className="pill"><b>✦</b>{label}</span>
            ))}
          </div>
        </div>
        <BoardMock />
      </div>
    </header>
  );
}
