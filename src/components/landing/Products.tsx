import Link from "next/link";
import { Flower } from "./Flower";
import { Ticks } from "./Ticks";

export function Products() {
  return (
    <section id="products">
      <div className="wrap">
        <div className="center-head">
          <p className="eyebrow">Що всередині</p>
          <h2>Дві частини — одна платформа</h2>
        </div>
        <div className="two">
          <article className="card product" id="tests">
            <Flower style={{ right: -50, top: -50 }} />
            <span className="num">01 / тести</span>
            <h3>Тести НМТ минулих років</h3>
            <p>
              Справжні завдання попередніх сесій у тому самому форматі, що й на іспиті. Тренуйтесь
              на реальних варіантах, а не на вигаданих.
            </p>
            <Ticks
              items={[
                "Тестові завдання, відповідності та відкриті відповіді",
                "Миттєва перевірка і підрахунок балів",
                "Пояснення до розв’язання",
                "Історія спроб — видно, що підтягнути",
              ]}
            />
            <Link className="btn" href="/register">Почати тренування</Link>
          </article>
          <article className="card product" id="board">
            <Flower tone="mint" style={{ right: -50, top: -50, transform: "rotate(22deg)" }} />
            <span className="num">02 / дошка</span>
            <h3>Математична дошка</h3>
            <p>
              Безмежне полотно, створене для математики: будуйте графіки, кресліть фігури, пишіть
              формули — і все це разом із класом у реальному часі.
            </p>
            <Ticks
              items={[
                "Графіки функцій, нерівності, повзунки параметрів",
                "Плоскі й об’ємні фігури, перерізи, побудови",
                "Формули, лінійка, транспортир, циркуль",
                "Спільна робота, коментарі, тести просто на дошці",
              ]}
            />
            <Link className="btn" href="/register">Створити дошку</Link>
          </article>
        </div>
      </div>
    </section>
  );
}
