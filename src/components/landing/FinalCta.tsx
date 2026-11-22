import Link from "next/link";
import { ArrowIcon } from "./icons";

export function FinalCta() {
  return (
    <section className="final">
      <div className="wrap">
        <h2>Математика стає зрозумілою, коли її <em>видно</em></h2>
        <p className="lead">Відкрийте дошку або візьміть перший тест — це займе хвилину.</p>
        <div className="cta">
          <Link className="btn lg" href="/register">
            Почати безплатно <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}
