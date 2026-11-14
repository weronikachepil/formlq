import Link from "next/link";
import { Flower } from "./Flower";

export function FinalCta() {
  return (
    <section>
      <div className="wrap">
        <div className="card final">
          <Flower style={{ left: -60, top: -60 }} />
          <Flower tone="mint" style={{ right: -60, bottom: -60, transform: "rotate(22deg)" }} />
          <p className="eyebrow">Почніть сьогодні</p>
          <h2>Математика стає зрозумілою, коли її видно</h2>
          <p className="lead">Відкрийте дошку або візьміть перший тест — це займе хвилину.</p>
          <div className="cta">
            <Link className="btn" href="/register">Спробувати дошку</Link>
            <a className="btn ghost" href="#tests">Тести</a>
          </div>
        </div>
      </div>
    </section>
  );
}
