import Link from "next/link";
import { QuizCard, ScoreCard } from "./MockCards";
import { Ticks } from "./Ticks";
import { ArrowIcon } from "./icons";

export function TestsSection() {
  return (
    <section id="tests">
      <div className="wrap split">
        <div>
          <p className="eyebrow">01 / Тести</p>
          <h2>Тести НМТ і від викладачів</h2>
          <p className="lead">
            Справжні завдання минулих сесій у форматі іспиту та тести для 5–11 класів. Помилка не
            страшна: поруч правильна відповідь і пояснення.
          </p>
          <Ticks
            items={[
              "Бал за шкалою НМТ одразу після тесту",
              "Розбір кожного завдання",
              "Історія спроб — видно, які теми провисають",
            ]}
          />
          <Link className="btn" href="/register">
            Почати тренування <ArrowIcon />
          </Link>
        </div>
        <div className="stack" aria-hidden="true">
          <QuizCard />
          <ScoreCard className="over" />
        </div>
      </div>
    </section>
  );
}
