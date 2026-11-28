import Link from "next/link";
import { BoardMock } from "./BoardMock";
import { ArrowIcon } from "./icons";
import { SeasonGarland } from "../advent/SiteWinter";

const FACTS = ["Тести для 5–11 класів і НМТ", "Домашні від викладача", "Дошка для уроків"];

export function Hero() {
  return (
    <header className="hero" id="top">
      <SeasonGarland className="hero-garland" />
      <div className="wrap hero-grid">
        <div>
          <p className="eyebrow">Для учнів і викладачів</p>
          <h1>
            <em>Математика</em> <br />від 5&nbsp;класу до&nbsp;НМТ
          </h1>
          <p className="lead">
            Тести з автоперевіркою та розбором, домашні завдання від викладача й дошка з графіками,
            фігурами та формулами, де вчитель і учні працюють разом.
          </p>
          <div className="cta">
            <Link className="btn lg" href="/register">
              Почати безплатно <ArrowIcon />
            </Link>
            <a className="btn ghost lg" href="#tests">Як виглядають тести</a>
          </div>
          <ul className="facts">
            {FACTS.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <BoardMock patternId="hero-grid" />
      </div>
    </header>
  );
}
