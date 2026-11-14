import type { ComponentType } from "react";
import {
  ChartIcon,
  CheckboxIcon,
  CompassIcon,
  CubeIcon,
  FormulaIcon,
  PeopleIcon,
} from "./icons";

const FEATURES: { Icon: ComponentType; title: string; text: string }[] = [
  {
    Icon: ChartIcon,
    title: "Графіки й аналіз",
    text: "Функції, неявні криві, нерівності. Нулі, екстремуми, дотична й площа під кривою — автоматично.",
  },
  {
    Icon: CubeIcon,
    title: "Об’ємні фігури",
    text: "Куб, піраміда, циліндр та інші тіла з перерізами, прихованими ребрами й вільним обертанням.",
  },
  {
    Icon: CompassIcon,
    title: "Креслення й побудови",
    text: "Лінійка, транспортир, циркуль, паралельні та перпендикуляри, вписані й описані кола.",
  },
  {
    Icon: FormulaIcon,
    title: "Формули без болю",
    text: "Зручний редактор формул, дроби, корені, системи — все виглядає як у підручнику.",
  },
  {
    Icon: PeopleIcon,
    title: "Урок разом",
    text: "Курсори учасників, вказівка, режим «учні дивляться», особисті аркуші та здача робіт.",
  },
  {
    Icon: CheckboxIcon,
    title: "Тести на дошці",
    text: "Створюйте контрольні прямо на полотні, отримуйте відповіді й результати в таблиці.",
  },
];

export function Features() {
  return (
    <section>
      <div className="wrap">
        <div className="center-head">
          <p className="eyebrow">Можливості</p>
          <h2>Усе для уроку математики</h2>
        </div>
        <div className="grid3">
          {FEATURES.map(({ Icon, title, text }) => (
            <div key={title} className="card feat">
              <div className="ic"><Icon /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
