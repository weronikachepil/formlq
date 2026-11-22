import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowIcon,
  ChartIcon,
  CheckboxIcon,
  CompassIcon,
  CubeIcon,
  FormulaIcon,
  PeopleIcon,
} from "./icons";

// Columns share a colour: algebra (lavender), geometry (mint), the lesson itself (peach).
const FEATURES: { Icon: ComponentType; title: string; text: string; tone: "lav" | "mint" | "peach" }[] = [
  {
    Icon: ChartIcon,
    tone: "lav",
    title: "Графіки й аналіз",
    text: "Функції, нерівності, нулі, екстремуми, дотична й площа під кривою — автоматично.",
  },
  {
    Icon: CubeIcon,
    tone: "mint",
    title: "Об’ємні фігури",
    text: "Куб, піраміда, циліндр з перерізами, прихованими ребрами й вільним обертанням.",
  },
  {
    Icon: PeopleIcon,
    tone: "peach",
    title: "Урок разом",
    text: "Курсори учасників, режим «учні дивляться», особисті аркуші та здача робіт.",
  },
  {
    Icon: FormulaIcon,
    tone: "lav",
    title: "Формули",
    text: "Дроби, корені, системи — усе виглядає як у підручнику.",
  },
  {
    Icon: CompassIcon,
    tone: "mint",
    title: "Креслення й побудови",
    text: "Лінійка, транспортир, циркуль, паралельні, перпендикуляри, вписані й описані кола.",
  },
  {
    Icon: CheckboxIcon,
    tone: "peach",
    title: "Тести на дошці",
    text: "Контрольна прямо на полотні, відповіді й бали — у таблиці.",
  },
];

export function Features() {
  return (
    <section id="board">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <p className="eyebrow">02 / Дошка</p>
            <h2>Дошка, яка знає математику</h2>
          </div>
          <Link className="btn ghost" href="/register">
            Створити дошку <ArrowIcon />
          </Link>
        </div>
        <div className="grid3">
          {FEATURES.map(({ Icon, title, text, tone }) => (
            <div key={title} className="feat">
              <div className={`ic ${tone}`}><Icon /></div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
