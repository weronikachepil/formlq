"use client";

import { useState, useSyncExternalStore } from "react";
import { BONUS, DAYS, GIFT_TESTS, NICHOLAS_GIFT, ZSU_SHARE, type ProblemDay } from "@/lib/advent";
import { PRICE_STUDENT } from "@/lib/advent-shop";
import { ProblemBody, type DayState } from "./AdventCalendar";
import { BonusGame } from "./arcade";
import { TileIcon, DAY_ICONS } from "./Winter";

/**
 * What the calendar is, for people who don't have it yet: try one problem and one game,
 * see what's inside, the 24-day plan, how it works for teachers, and answers to the usual
 * questions. Everything is taken from the real calendar data, so it can't drift from it.
 * Rendered under the buy / code cards (cabinet) and the «how to get access» card (guests).
 */

/** A free sample that is not one of the 24 windows, so nothing is spoiled. */
const SAMPLE: ProblemDay = {
  kind: "problem",
  day: 0,
  level: 1,
  topic: "Відсотки",
  text: "Ялинкова гірлянда має 120 лампочок, і 25 % з них червоні. Скільки червоних лампочок у гірлянді?",
  answer: 30,
  hint: "25 % — це чверть.",
  solution: "$120 \\cdot 0{,}25 = 30$ лампочок.",
};

const PROBLEMS = DAYS.filter((d): d is ProblemDay => d.kind === "problem");
const GAMES = DAYS.filter((d) => d.kind === "game");
const TOPICS = [...new Set(PROBLEMS.map((p) => p.topic.toLowerCase()))].filter((t) => t !== "фінал");
const STARS = ["", "★", "★★", "★★★"];

function SampleProblem() {
  const [state, setState] = useState<DayState>({});
  return (
    <div className="adv-demo card">
      <p className="adv-demo-tag">Задача · {STARS[SAMPLE.level]} · {SAMPLE.topic}</p>
      <p className="problem">{SAMPLE.text}</p>
      <ProblemBody p={SAMPLE} state={state} onUpdate={(patch) => setState((s) => ({ ...s, ...patch }))} demo />
    </div>
  );
}

const noop = () => () => {};

function SampleGame() {
  // The house is random: draw it only in the browser, so the server HTML can't disagree with it.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const [round, setRound] = useState(0);
  const [won, setWon] = useState<string | null>(null);
  return (
    <div className="adv-demo card">
      <p className="adv-demo-tag">Гра з Ігротеки · «Вікна у Святвечір»</p>
      <p className="problem">Засвіти всі вікна будинку. Торкання перемикає вікно і його сусідів.</p>
      {won ? (
        <div className="result ok" role="status">
          <p className="res-title">Перемога!</p>
          <p className="res-sol">{won}</p>
          <button type="button" className="link" onClick={() => { setWon(null); setRound(round + 1); }}>Ще раз</button>
        </div>
      ) : mounted ? (
        <BonusGame key={round} id="lights" onWin={setWon} />
      ) : (
        <div className="adv-demo-placeholder" aria-hidden />
      )}
    </div>
  );
}

export function AdventPreview() {
  return (
    <div className="adv-preview">
      {/* 1. Try it */}
      <section>
        <h2 className="adv-h2">Спробуй зараз — безкоштовно</h2>
        <p className="adv-access-lead">Одна задача й одна гра, щоб відчути формат. Таких у календарі — 24 дні й ще 4 бонусні ігри.</p>
        <div className="adv-demo-grid">
          <SampleProblem />
          <SampleGame />
        </div>
      </section>

      {/* 2. What's inside */}
      <section>
        <h2 className="adv-h2">Що всередині</h2>
        <div className="adv-inside">
          <div className="card adv-in">
            <span className="adv-in-num">{PROBLEMS.length}</span>
            <h3>задач у стилі НМТ</h3>
            <p>
              Відповідь — число, як у відкритій частині НМТ. До кожної є підказка й розв&apos;язок.
              Складність росте щотижня: від ★ до ★★★.
            </p>
            <p className="adv-in-topics">Теми: {TOPICS.join(", ")}.</p>
          </div>
          <div className="card adv-in">
            <span className="adv-in-num">{GAMES.length}</span>
            <h3>різдвяних міні-ігор</h3>
            <p>По суботах і неділях замість задачі — гра на математичне мислення.</p>
            <p className="adv-in-topics">{GAMES.map((g) => g.topic.replace(/^Гра /, "")).join(", ")}.</p>
          </div>
          <div className="card adv-in">
            <span className="adv-in-num">{BONUS.length}</span>
            <h3>бонусні ігри в Ігротеці</h3>
            <p>Грай скільки хочеш; нові відкриваються, коли розв&apos;язуєш віконця.</p>
            <p className="adv-in-topics">{BONUS.map((b) => `«${b.title}»`).join(", ")}.</p>
          </div>
          <div className="card adv-in adv-in-gift">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/advent/konspekt-cover.png" alt="Обкладинка конспекту «Функції від А до Я»" width={120} height={170} />
            <div>
              <p className="adv-in-when">6 грудня · подарунок від Миколая</p>
              <h3>Конспект «{NICHOLAS_GIFT.title}»</h3>
              <p>{NICHOLAS_GIFT.subtitle}. {NICHOLAS_GIFT.meta}.</p>
            </div>
          </div>
          <div className="card adv-in adv-in-gift">
            <span className="adv-in-icon" aria-hidden><TileIcon name="gift" /></span>
            <div>
              <p className="adv-in-when">Після всіх 24 віконець</p>
              <h3>{GIFT_TESTS.length} імітацій НМТ</h3>
              <p>
                Повні тести у форматі НМТ з математики: бал за шкалою 100–200, таймер і розбір помилок.
                З&apos;являються в розділі «Тести» кабінету й залишаються там.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. The 24 days */}
      <section>
        <h2 className="adv-h2">Розклад на 24 дні</h2>
        <ol className="adv-plan" aria-label="Що чекає щодня">
          {DAYS.map((d) => (
            <li key={d.day} className={d.kind === "game" ? "game" : ""}>
              <span className="d">{d.day}</span>
              <TileIcon name={DAY_ICONS[d.day - 1]} />
              <span className="what">{d.kind === "game" ? "гра" : STARS[d.level]}</span>
            </li>
          ))}
        </ol>
        <p className="adv-access-note">Віконце відкривається опівночі за Києвом. Пропущені дні можна наздогнати будь-коли.</p>
      </section>

      {/* 4. Teachers */}
      <section className="card adv-teach-card">
        <p className="adv-demo-tag">Для вчителів</p>
        <h2 className="adv-h2">Календар для всього класу</h2>
        <ol className="adv-teach">
          <li style={{ ["--c" as string]: "var(--lav)" }}>
            <span className="n">1</span>
            <b>Замовляєте коди</b>
            <span>По одному на кожного учня — у нашому Telegram-каналі.</span>
          </li>
          <li style={{ ["--c" as string]: "var(--mint)" }}>
            <span className="n">2</span>
            <b>Роздаєте учням</b>
            <span>Біля кожного коду в кабінеті — кнопка з готовим повідомленням.</span>
          </li>
          <li style={{ ["--c" as string]: "var(--peach)" }}>
            <span className="n">3</span>
            <b>Бачите, хто долучився</b>
            <span>Ім&apos;я учня й дату активації. Один код — один акаунт.</span>
          </li>
          <li style={{ ["--c" as string]: "#f4c430" }}>
            <span className="n">4</span>
            <b>Отримуєте календар і {GIFT_TESTS.length} імітацій</b>
            <span>Щойно перший учень введе код. Імітації можна задати як домашнє.</span>
          </li>
        </ol>
        <div className="adv-prices">
          <div><b>99 грн</b><span>за код</span></div>
          <div><b>79 грн</b><span>за код, від 20 кодів</span></div>
          <div><b>0 грн</b><span>ваш власний доступ</span></div>
          <div className="muted"><b>{PRICE_STUDENT} грн</b><span>якщо учень купує сам</span></div>
        </div>
      </section>

      {/* 5. FAQ */}
      <section>
        <h2 className="adv-h2">Питання</h2>
        <div className="adv-faq card">
          <details>
            <summary>Що, якщо я пропущу день?</summary>
            <p>Нічого страшного: відкриті віконця залишаються відкритими, наздогнати можна будь-коли.</p>
          </details>
          <details>
            <summary>Для якого класу?</summary>
            <p>Для 10–11 класу й усіх, хто готується до НМТ. Перший тиждень — розминка, далі задачі рівня НМТ.</p>
          </details>
          <details>
            <summary>Чи потрібен акаунт?</summary>
            <p>Так, безкоштовний акаунт formlq: код прив&apos;язується до нього, а імітації з&apos;являються в розділі «Тести».</p>
          </details>
          <details>
            <summary>Де зберігається прогрес?</summary>
            <p>
              Розв&apos;язані віконця й літери фрази — у браузері, де ти розв&apos;язуєш, тож краще проходити календар на одному
              пристрої. Імітації після проходження прив&apos;язуються до акаунта й доступні звідусіль.
            </p>
          </details>
          <details>
            <summary>Що залишиться після грудня?</summary>
            <p>Конспект — у тебе на пристрої, імітації — у кабінеті formlq. Календар можна дорозв&apos;язувати й після Святвечора.</p>
          </details>
          <details>
            <summary>Куди йдуть гроші?</summary>
            <p>На розвиток formlq, а {ZSU_SHARE}% доходу від календаря ми передаємо на ЗСУ.</p>
          </details>
        </div>
      </section>
    </div>
  );
}
