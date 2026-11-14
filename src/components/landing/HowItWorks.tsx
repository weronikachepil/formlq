const STEPS: { title: string; text: string }[] = [
  {
    title: "Оберіть режим",
    text: "Тренуйтеся на тестах НМТ або відкрийте дошку для заняття чи самостійної роботи.",
  },
  {
    title: "Працюйте",
    text: "Розв’язуйте завдання, будуйте графіки й фігури, діліться дошкою за посиланням.",
  },
  {
    title: "Аналізуйте",
    text: "Дивіться бали, розбір помилок і прогрес — і знайте, що повторити перед іспитом.",
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <div className="wrap">
        <div className="center-head">
          <p className="eyebrow">Як це працює</p>
          <h2>Три кроки до результату</h2>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div key={s.title} className="card step">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
