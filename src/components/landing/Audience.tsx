import { Ticks } from "./Ticks";

export function Audience() {
  return (
    <section>
      <div className="wrap">
        <p className="eyebrow">Для кого</p>
        <h2>І для учнів, і для вчителів</h2>
        <div className="who">
          <div className="card lav">
            <h3>Учням</h3>
            <Ticks
              items={[
                "Тренуйтеся на тестах НМТ і тестах від викладачів",
                "Одразу бачите результат і розбір",
                "Вчитеся наочно — на графіках і фігурах",
              ]}
            />
          </div>
          <div className="card mint">
            <h3>Вчителям і репетиторам</h3>
            <Ticks
              items={[
                "Проводьте уроки на дошці, створеній для математики",
                "Давайте тести й домашні з дедлайном, результати — в таблиці",
                "Публікуйте свої тести для всіх учнів платформи",
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
