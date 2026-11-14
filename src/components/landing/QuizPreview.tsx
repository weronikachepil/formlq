const OPTIONS: { letter: string; value: string; correct?: boolean }[] = [
  { letter: "А", value: "16" },
  { letter: "Б", value: "20", correct: true },
  { letter: "В", value: "24" },
  { letter: "Г", value: "12" },
  { letter: "Д", value: "18" },
];

const TABS = ["А–Д", "Відповідності", "Відкриті", "Таймер"];

export function QuizPreview() {
  return (
    <section>
      <div className="wrap split">
        <div>
          <p className="eyebrow">Тренування</p>
          <h2>Як виглядає завдання</h2>
          <p className="lead">
            Обираєте варіант — відповідаєте — одразу бачите результат. Помилка не страшна: поруч
            пояснення, як дійти до правильної відповіді.
          </p>
          <div className="q-tabs">
            {TABS.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <div className="card quiz" aria-hidden="true">
          <div className="q-head">
            <span className="q-n">7</span>
            <span className="q-t">Один правильний варіант</span>
            <span className="q-pts">1 бал</span>
          </div>
          <div className="q-text">Обчисліть значення виразу 2³ · 3 − 4.</div>
          <div className="opts">
            {OPTIONS.map((o) => (
              <div key={o.letter} className={o.correct ? "opt ok" : "opt"}>
                <b>{o.letter}</b>{o.value}
              </div>
            ))}
          </div>
          <div className="q-foot">✓ Правильно · +1 бал</div>
        </div>
      </div>
    </section>
  );
}
