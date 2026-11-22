/** Decorative product previews: a test question and a result card. */

const OPTIONS: { letter: string; value: string; correct?: boolean }[] = [
  { letter: "А", value: "16" },
  { letter: "Б", value: "20", correct: true },
  { letter: "В", value: "24" },
  { letter: "Г", value: "12" },
];

export function QuizCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card quiz ${className}`} aria-hidden="true">
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
  );
}

const TOPICS: { name: string; score: string; tone: "ok" | "warn" | "bad" }[] = [
  { name: "Алгебра", score: "9 / 10", tone: "ok" },
  { name: "Геометрія", score: "6 / 8", tone: "warn" },
  { name: "Стереометрія", score: "2 / 4", tone: "bad" },
];

export function ScoreCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card score ${className}`} aria-hidden="true">
      <p className="sc-label">Результат тесту</p>
      <p className="sc-num">186<span> / 200</span></p>
      <div className="sc-bar"><i style={{ width: "86%" }} /></div>
      <ul className="sc-topics">
        {TOPICS.map((t) => (
          <li key={t.name}>
            {t.name}
            <span className={`badge ${t.tone}`}>{t.score}</span>
          </li>
        ))}
      </ul>
      <p className="sc-hint">Повторіть стереометрію — тут найбільше помилок</p>
    </div>
  );
}
