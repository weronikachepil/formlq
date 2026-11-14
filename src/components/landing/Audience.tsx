import { Flower } from "./Flower";
import { Ticks } from "./Ticks";

export function Audience() {
  return (
    <section>
      <div className="wrap">
        <div className="center-head">
          <p className="eyebrow">Для кого</p>
          <h2>І для учнів, і для вчителів</h2>
        </div>
        <div className="who">
          <div className="card">
            <Flower
              tone="peach"
              style={{ right: -60, bottom: -70, top: "auto", transform: "rotate(14deg)" }}
            />
            <h3>Учням</h3>
            <Ticks
              style={{ margin: 0 }}
              items={[
                "Тренуйтеся на тестах НМТ і тестах від викладачів",
                "Одразу бачите результат і розбір",
                "Вчитеся наочно — на графіках і фігурах",
              ]}
            />
          </div>
          <div className="card">
            <Flower
              tone="mint"
              style={{ right: -60, bottom: -70, top: "auto", transform: "rotate(22deg)" }}
            />
            <h3>Вчителям і репетиторам</h3>
            <Ticks
              style={{ margin: 0 }}
              items={[
                "Проводьте уроки на дошці, створеній для математики",
                "Давайте тести й отримуйте результати в таблиці",
                "Публікуйте свої тести для всіх учнів платформи",
                "Зберігайте дошки та повертайтеся до них",
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
