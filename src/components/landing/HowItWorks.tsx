const STEPS: { title: string; text: string }[] = [
  {
    title: "Оберіть режим",
    text: "Тест НМТ, тест від викладача або дошка для заняття.",
  },
  {
    title: "Працюйте",
    text: "Розв’язуйте завдання, будуйте графіки й фігури, діліться дошкою за посиланням.",
  },
  {
    title: "Аналізуйте",
    text: "Бали, розбір помилок і прогрес — знаєте, що повторити перед іспитом.",
  },
];

export function HowItWorks() {
  return (
    <section id="how">
      <div className="wrap">
        <p className="eyebrow">Як це працює</p>
        <h2>Три кроки</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
