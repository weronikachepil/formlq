"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { MathText } from "@/components/MathText";
import { publicTestPath, studentTestPath } from "@/lib/tests";
import { useAuth } from "@/context/AuthContext";
import { ZSU_SHARE } from "@/lib/advent";
import { markAdventFinished } from "@/lib/advent-gift";
import { AdventMap } from "./AdventMap";
import { AdventCase } from "./AdventCase";
import { SCENES } from "@/lib/advent-scenes";
import {
  ADVENT_DAYS, ADVENT_YEAR, BONUS, DAYS, type Bonus, GIFT_TESTS, NICHOLAS_GIFT, PHRASE, PHRASE_LETTERS,
  daysUntilStart, isCorrect, openedDays, parseAnswer, type AdventDay, type ProblemDay,
} from "@/lib/advent";
import { Game } from "./games";
import { BonusGame } from "./arcade";
import { DAY_ICONS, Garland, Hills, Snowfall, TileBow, TileIcon } from "./Winter";

/* ---------- progress in localStorage ---------- */

export interface DayState { solved?: boolean; gaveUp?: boolean; attempts?: number; /** Game result, e.g. «Усі пари за 9 ходів». */ note?: string }
/** Keyed by day number, plus `bonus-<id>` for «Ігротека» wins. */
type Progress = Record<string, DayState>;

const KEY = `formlq-advent-${ADVENT_YEAR}`;
const listeners = new Set<() => void>();

function readRaw(): string {
  try { return localStorage.getItem(KEY) ?? "{}"; } catch { return "{}"; }
}
function writeProgress(p: Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: progress lives for this visit */ }
  memRaw = JSON.stringify(p);
  listeners.forEach((l) => l());
}
let memRaw: string | null = null;
function subscribeProgress(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { memRaw = null; cb(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}
function getRaw() { return memRaw ?? (memRaw = readRaw()); }

function useProgress(): Progress | null {
  const raw = useSyncExternalStore(subscribeProgress, getRaw, () => null);
  return useMemo(() => {
    if (raw === null) return null;
    try { return JSON.parse(raw) as Progress; } catch { return {}; }
  }, [raw]);
}

/* ---------- which days are open (Kyiv time, re-checked every minute) ---------- */

function devDayOverride(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  const d = Number(new URLSearchParams(window.location.search).get("day"));
  return Number.isInteger(d) && d >= 0 && d <= ADVENT_DAYS ? d : null;
}
/**
 * Dev only: `?solved=N` marks windows 1–N as solved, `?solved=0` clears progress.
 * Handy to see the gift (`/advent?day=24&solved=24`) without solving everything.
 */
function useDevSolved() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const raw = new URLSearchParams(window.location.search).get("solved");
    if (raw === null) return;
    const n = Math.max(0, Math.min(ADVENT_DAYS, Number(raw) || 0));
    const cur = JSON.parse(getRaw()) as Progress;
    const next: Progress = Object.fromEntries(Object.entries(cur).filter(([k]) => k.startsWith("bonus-")));
    for (let d = 1; d <= n; d++) next[d] = { ...cur[d], solved: true };
    writeProgress(next);
  }, []);
}
function subscribeClock(cb: () => void) {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
}
function useOpened(): number | null {
  return useSyncExternalStore(subscribeClock, () => devDayOverride() ?? openedDays(), () => null);
}

/* ---------- snow on/off: off by default with «reduce motion» ---------- */

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
}

const STARS = ["", "★", "★★", "★★★"];
const LEVEL_NAME = ["", "легка", "середня", "складна"];

/** Confetti on a canvas inside the open dialog: the modal's top layer would hide a page-level one. */
function celebrate(big = false) {
  const host = document.querySelector<HTMLDialogElement>("dialog.adv-dialog[open]") ?? document.body;
  const canvas = document.createElement("canvas");
  canvas.className = "adv-confetti";
  host.appendChild(canvas);
  const fire = confetti.create(canvas, { resize: true, disableForReducedMotion: true });
  window.setTimeout(() => { fire.reset(); canvas.remove(); }, 4000);
  fire({
    particleCount: big ? 160 : 60, spread: big ? 100 : 60, origin: { y: 0.7 },
    colors: ["#cfc6f7", "#bfe0dd", "#ffddc4", "#f4c430", "#14262a"],
  });
}

/* ---------- page ---------- */

/**
 * The whole calendar. With `locked`, only the hero is shown and `locked` replaces the rest
 * (the code entry for a student without access, or how to get access for a guest).
 */
export function AdventCalendar({ locked, allOpen = false }: {
  locked?: React.ReactNode;
  /** Editors: every window open now, whatever the date, to check problems and games. */
  allOpen?: boolean;
} = {}) {
  const progress = useProgress();
  useDevSolved();
  const datedOpened = useOpened();
  const opened = allOpen && datedOpened !== null ? ADVENT_DAYS : datedOpened;
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [openBonus, setOpenBonus] = useState<Bonus | null>(null);
  const reducedMotion = useReducedMotion();
  const [snowChoice, setSnowChoice] = useState<boolean | null>(null);
  const snowOn = snowChoice ?? !reducedMotion;

  const ready = progress !== null && opened !== null;
  // Only windows that have already opened count: stale or edited progress from the browser
  // can't unlock the gift or «Ігротека» before their days.
  const solvedCount = ready ? DAYS.filter((p) => p.day <= opened && isDone(progress[p.day])).length : 0;
  const started = ready && opened > 0;
  const finished = solvedCount === ADVENT_DAYS;

  // All 24 solved by someone signed in (the calendar only opens with access): remember it on
  // their account, so the gift imitations show in «Тести» on every device.
  const { user, userProfile, refreshProfile } = useAuth();
  const giftSaved = !!userProfile?.adventGiftAt;
  useEffect(() => {
    if (!finished || locked || !user || giftSaved) return;
    markAdventFinished(user.uid).then(refreshProfile).catch(() => { /* retried on the next visit */ });
  }, [finished, locked, user, giftSaved, refreshProfile]);
  const today = opened && opened <= ADVENT_DAYS ? opened : null;
  // The hero's one main action: today's window, or the earliest open day still unsolved.
  const target = !ready || !opened ? null
    : today && !isDone(progress[today]) ? today
    : DAYS.find((d) => d.day <= opened && !isDone(progress[d.day]))?.day ?? null;

  function update(day: number | string, patch: DayState) {
    const cur = progress ?? {};
    const next = { ...cur, [day]: { ...cur[day], ...patch } };
    writeProgress(next);
    if (patch.solved || patch.gaveUp) {
      const done = DAYS.filter((p) => isDone(next[p.day])).length;
      celebrate(done === ADVENT_DAYS);
    }
  }

  return (
    <div className="advent" id="top">
      <section className="adv-hero">
        <Snowfall on={snowOn} />
        <Garland />
        <button type="button" className="adv-snow-toggle" aria-pressed={snowOn} onClick={() => setSnowChoice(!snowOn)}>
          <svg viewBox="0 0 24 24" aria-hidden><path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" /></svg>
          {snowOn ? "Вимкнути сніг" : "Увімкнути сніг"}
        </button>
        <div className="wrap">
          <p className="eyebrow">Адвент-календар · 1–24 грудня</p>
          <h1>Відлік до <em>НМТ</em></h1>
          <p className="adv-zsu-hero">
            <span className="adv-flag" aria-hidden><i /><i /></span>
            {ZSU_SHARE}% доходу — на ЗСУ
          </p>
          <p className="lead">
            24 віконця, по одному на день: задачі в стилі НМТ, а на вихідних міні-ігри.
            Кожна перемога відкриває літеру фрази‑ключа. Збери всю фразу — і відкриєш подарунок: {GIFT_TESTS.length} {plural(GIFT_TESTS.length, "імітацію", "імітації", "імітацій")} НМТ.
          </p>
          {!locked && <Status ready={ready} opened={opened} solved={solvedCount} />}
          {!locked && target !== null && (
            <div className="cta">
              <button type="button" className="btn lg adv-cta" onClick={() => setOpenDay(target)}>
                {target === today
                  ? DAYS[target - 1].kind === "game" ? "Зіграти в гру дня" : "Відкрити задачу дня"
                  : `Наздогнати ${target} грудня`}
                <svg className="arrow" viewBox="0 0 24 24" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          )}
        </div>
        <Hills />
      </section>

      {locked ? (
        <section className="adv-cipher-sec soft adv-locked-sec">
          <div className="wrap">{locked}</div>
        </section>
      ) : (<>
      <section className="adv-cipher-sec soft" aria-labelledby="cipher-title">
        <div className="wrap">
          <h2 id="cipher-title" className="adv-h2">Фраза‑ключ до подарунка</h2>
          <Cipher progress={progress ?? {}} opened={opened ?? 0} />
          <Gift ready={ready} solved={solvedCount} />
        </div>
      </section>

      <section className="adv-map-sec" aria-labelledby="map-title">
        <div className="wrap">
          <AdventMap isSolved={(day) => !!opened && day <= opened && isDone(progress?.[day])} />
          <AdventCase isSolved={(day) => !!opened && day <= opened && isDone(progress?.[day])} />
        </div>
      </section>

      <section className="adv-grid-sec" aria-labelledby="grid-title">
        <div className="wrap">
          <div className="adv-grid-head">
            <h2 id="grid-title" className="adv-h2">Віконця</h2>
            <ul className="adv-legend" aria-label="Позначення">
              <li><span className="lg lg-open" /> відкрите</li>
              <li><span className="lg lg-done" /> розв&apos;язане — світло горить</li>
              <li><span className="lg lg-lock" /> подарунок, ще закрите</li>
            </ul>
          </div>
          <ol className="adv-grid">
            {DAYS.map((p) => (
              <Tile
                key={p.day}
                p={p}
                state={progress?.[p.day]}
                ready={ready}
                locked={!ready || p.day > (opened ?? 0)}
                isToday={p.day === today}
                onOpen={() => setOpenDay(p.day)}
              />
            ))}
          </ol>
          <p className="adv-note">
            ★ легка · ★★ середня · ★★★ складна. По суботах і неділях замість задачі міні-гра,
            а 6 грудня на тебе чекає подарунок від Миколая. Пропущені дні можна наздогнати.
            Прогрес зберігається в цьому браузері.
          </p>
        </div>
      </section>

      <section className="adv-arcade-sec soft" aria-labelledby="arcade-title">
        <div className="wrap">
          <div className="adv-grid-head">
            <h2 id="arcade-title" className="adv-h2">Ігротека</h2>
            <p className="adv-sub">Бонусні ігри: грай скільки хочеш. Нові відкриваються, коли розв&apos;язуєш віконця.</p>
          </div>
          <ul className="adv-arcade">
            {BONUS.map((b) => {
              const locked = !started || solvedCount < b.unlockAt;
              const won = !!progress?.[`bonus-${b.id}`]?.solved;
              const left = b.unlockAt - solvedCount;
              return (
                <li key={b.id}>
                  <button type="button" className={`arc-card${locked ? " locked" : ""}${won ? " won" : ""}`}
                    disabled={locked} onClick={() => setOpenBonus(b)}>
                    <span className="arc-icon">{locked ? <TileBow /> : <TileIcon name={b.icon} />}</span>
                    <span className="arc-text">
                      <b>{b.title}</b>
                      <span>
                        {!ready ? "\u00a0" : locked
                          ? !started
                            ? "Відкриється 1 грудня, разом із календарем"
                            : `Відкриється після ${b.unlockAt} розв'язаних віконець (ще ${left})`
                          : won ? "Пройдено ✓ · зіграти ще" : b.text}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {openBonus && progress && (
        <BonusDialog
          key={openBonus.id}
          b={openBonus}
          state={progress[`bonus-${openBonus.id}`] ?? {}}
          onWin={(note) => update(`bonus-${openBonus.id}`, { solved: true, note })}
          onClose={() => setOpenBonus(null)}
        />
      )}

      {openDay !== null && progress && (
        <DayDialog
          key={openDay}
          p={DAYS[openDay - 1]}
          state={progress[openDay] ?? {}}
          hasNext={openDay < (opened ?? 0)}
          allDone={finished}
          onUpdate={(patch) => update(openDay, patch)}
          onNext={() => setOpenDay(openDay + 1)}
          onClose={() => setOpenDay(null)}
        />
      )}
      </>)}
    </div>
  );
}

function isDone(s?: DayState) { return !!(s?.solved || s?.gaveUp); }

function Status({ ready, opened, solved }: { ready: boolean; opened: number | null; solved: number }) {
  if (!ready) return <p className="adv-status" aria-hidden>&nbsp;</p>;
  if (opened === 0) {
    const n = daysUntilStart();
    return (
      <p className="adv-status">
        <strong>Старт 1 грудня</strong>
        {n > 0 && <> · залишилось {n} {plural(n, "день", "дні", "днів")}</>}
      </p>
    );
  }
  return (
    <div className="adv-status">
      <strong>Розв&apos;язано {solved} з {ADVENT_DAYS}</strong>
      <span className="adv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={ADVENT_DAYS} aria-valuenow={solved} aria-label="Прогрес">
        <span style={{ width: `${(solved / ADVENT_DAYS) * 100}%` }} />
      </span>
    </div>
  );
}

function Cipher({ progress, opened }: { progress: Progress; opened: number }) {
  let i = 0;
  return (
    <div className="adv-cipher" aria-label="Відкриті літери фрази">
      {PHRASE.split(" ").map((word, w) => (
        <span className="word" key={w}>
          {[...word].map(() => {
            const day = ++i;
            const shown = day <= opened && isDone(progress[day]);
            return (
              <span key={day} className={`cell${shown ? " shown" : ""}`} aria-label={shown ? `День ${day}: ${PHRASE_LETTERS[day - 1]}` : `День ${day}: ще не відкрито`}>
                <b>{shown ? PHRASE_LETTERS[day - 1] : ""}</b>
                <small>{day}</small>
              </span>
            );
          })}
        </span>
      ))}
    </div>
  );
}

/** Three NMT imitations: locked until all 24 windows are solved. */
function Gift({ ready, solved }: { ready: boolean; solved: number }) {
  const open = ready && solved >= ADVENT_DAYS;
  const left = ADVENT_DAYS - solved;
  const n = `${GIFT_TESTS.length} ${plural(GIFT_TESTS.length, "імітація", "імітації", "імітацій")} НМТ`;
  return (
    <div id="gift" className={`adv-gift${open ? " open" : ""}`}>
      <div className="gift-head">
        <span className="gift-box" aria-hidden><TileIcon name="gift" /></span>
        <div>
          <h3>{open ? `Подарунок відкрито: ${n}` : `Подарунок за всі 24 віконця: ${n}`}</h3>
          <p>
            {open
              ? "Фразу зібрано! Пройди імітації в повному форматі НМТ: з таймером, балом за шкалою 100–200 і розбором помилок. Вони також з’явилися в розділі «Тести» твого кабінету."
              : ready
                ? `Збери всю фразу, і відкриються повні імітації НМТ від formlq. Залишилось ${left} ${plural(left, "віконце", "віконця", "віконець")}.`
                : "Збери всю фразу, і відкриються повні імітації НМТ від formlq."}
          </p>
        </div>
      </div>
      <ul className="gift-tests">
        {GIFT_TESTS.map((t, i) => (
          <li key={i} className={open ? "" : "locked"}>
            <span className="gt-num" aria-hidden>{i + 1}</span>
            <b>{t.title}</b>
            {!open ? (
              <span className="gt-state"><LockIcon /> після 24 віконець</span>
            ) : t.id ? (
              <Link className="btn sm" href={t.anyone ? publicTestPath(t.id) : studentTestPath(t.id)}>Почати</Link>
            ) : (
              <span className="gt-state">Скоро</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Tile({ p, state, ready, locked, isToday, onOpen }: {
  p: AdventDay; state?: DayState; ready: boolean; locked: boolean; isToday: boolean; onOpen: () => void;
}) {
  const done = isDone(state);
  const cls = ["tile", locked ? "locked" : done ? "done" : "open", isToday && "today", p.kind === "game" && "game"].filter(Boolean).join(" ");
  const label = locked
    ? `День ${p.day}, відкриється ${p.day} грудня`
    : `День ${p.day}, ${p.topic}, ${LEVEL_NAME[p.level]}${done ? ", розв'язано" : ""}`;
  return (
    <li>
      <button type="button" className={cls} disabled={locked} onClick={onOpen} aria-label={label}>
        {locked ? <TileBow /> : <TileIcon name={DAY_ICONS[p.day - 1]} />}
        <span className="num">{p.day}</span>
        {ready && (
          <span className="meta">
            {locked ? (
              <><LockIcon /> {p.day} гру</>
            ) : done ? (
              <span className="letter">{PHRASE_LETTERS[p.day - 1]}</span>
            ) : (
              <span className="stars">{STARS[p.level]}</span>
            )}
          </span>
        )}
        {isToday && !done && <span className="tag">сьогодні</span>}
        {!isToday && p.gift && <span className="tag gift">Миколай</span>}
        {!isToday && !p.gift && p.kind === "game" && <span className="tag">гра</span>}
      </button>
    </li>
  );
}

/* ---------- one day: a problem or a game ---------- */

function DayDialog({ p, state, hasNext, allDone, onUpdate, onNext, onClose }: {
  p: AdventDay; state: DayState; hasNext: boolean; allDone: boolean;
  onUpdate: (patch: DayState) => void; onNext: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [replaying, setReplaying] = useState(false);
  const done = isDone(state);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // No close() in a cleanup: its async «close» event would fire onClose after a re-run
    // (Strict Mode, «Наступний день») and shut the dialog. Unmounting removes it anyway.
    if (!d.open) d.showModal();
    // Focus the answer field only with a mouse: on phones the keyboard would cover the problem.
    if (window.matchMedia("(pointer: fine)").matches) d.querySelector("input")?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`adv-dialog${p.kind === "game" ? " is-game" : ""}`}
      aria-labelledby="adv-dlg-title"
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="dlg-body">
        <header>
          <p className="dlg-meta">
            {STARS[p.level]} · {p.topic}
            {p.gift && p.kind !== "game" && " · подарунок від Миколая"}
          </p>
          <h2 id="adv-dlg-title">{p.day} грудня</h2>
          <button type="button" className="dlg-close" onClick={onClose} aria-label="Закрити">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {SCENES[p.day] && (
          <div className="adv-scene">
            <p className="k">🔍 Справа дня · {SCENES[p.day].title}</p>
            <p>{SCENES[p.day].setup}</p>
          </div>
        )}

        <div className="problem"><MathText text={p.text} /></div>

        {p.gift && !(done && !replaying) && (
          <p className="nick-teaser">
            <span aria-hidden>🎁</span> Виграй — і Миколай подарує тобі різдвяний конспект «{NICHOLAS_GIFT.title}».
          </p>
        )}

        {p.kind === "game" ? (
          done && !replaying ? (
            <div className="result ok" role="status">
              <p className="res-title">Перемога!</p>
              {state.note && <p className="res-sol">{state.note}</p>}
              <p className="res-letter">Літера дня: <b>{PHRASE_LETTERS[p.day - 1]}</b></p>
              {p.gift && <NicholasGift />}
              <button type="button" className="link" onClick={() => setReplaying(true)}>Зіграти ще раз</button>
            </div>
          ) : (
            <Game id={p.game} onWin={(note) => { setReplaying(false); onUpdate({ solved: true, note }); }} />
          )
        ) : (
          <ProblemBody p={p} state={state} onUpdate={onUpdate} />
        )}

        {done && !replaying && SCENES[p.day] && (
          <div className="adv-scene reveal" role="status">
            <p className="k">Розгадка дня</p>
            <p>{SCENES[p.day].reveal}</p>
          </div>
        )}

        {done && !replaying && (allDone || hasNext) && (
          <div className="dlg-foot">
            {allDone ? (
              <button type="button" className="btn" onClick={() => {
                onClose();
                document.getElementById("gift")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}>Відкрити подарунок 🎁</button>
            ) : (
              <button type="button" className="btn ghost" onClick={onNext}>Наступний день →</button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}

/** 6 December: the PDF study guide from St. Nicholas. */
function NicholasGift() {
  return (
    <div className="nick-gift">
      <span className="nick-icon" aria-hidden><TileIcon name="sock" /></span>
      <div className="nick-text">
        <p className="nick-label">Подарунок від Миколая</p>
        <b>{NICHOLAS_GIFT.title}</b>
        <span>{NICHOLAS_GIFT.subtitle}</span>
        <small>{NICHOLAS_GIFT.meta}</small>
      </div>
      <a className="btn sm" href={NICHOLAS_GIFT.href} download={NICHOLAS_GIFT.fileName}>Завантажити</a>
    </div>
  );
}

function BonusDialog({ b, state, onWin, onClose }: {
  b: Bonus; state: DayState; onWin: (note: string) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog ref={ref} className={`adv-dialog is-game${b.id === "logic" ? " is-wide" : ""}`} aria-labelledby="adv-bonus-title"
      onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg-body">
        <header>
          <p className="dlg-meta">Ігротека{state.solved && " · уже пройдено"}</p>
          <h2 id="adv-bonus-title">{b.title}</h2>
          <button type="button" className="dlg-close" onClick={onClose} aria-label="Закрити">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <p className="problem">{b.text}</p>
        {result ? (
          <div className="result ok" role="status">
            <p className="res-title">Перемога!</p>
            <p className="res-sol">{result}</p>
            <button type="button" className="link" onClick={() => { setResult(null); setRound(round + 1); }}>Зіграти ще раз</button>
          </div>
        ) : (
          <BonusGame key={round} id={b.id} onWin={(note) => { setResult(note); onWin(note); }} />
        )}
      </div>
    </dialog>
  );
}

/** A problem with an answer field, hint and solution. `demo`: the free sample, no letter of the phrase. */
export function ProblemBody({ p, state, onUpdate, demo = false }: {
  p: ProblemDay; state: DayState; onUpdate: (patch: DayState) => void; demo?: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const attempts = state.attempts ?? 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = parseAnswer(value);
    if (n === null) { setError("Введи число, наприклад 12 або 0,25."); return; }
    if (isCorrect(p, n)) { setError(null); onUpdate({ solved: true, attempts: attempts + 1 }); return; }
    setError("Не те число. Спробуй ще раз.");
    onUpdate({ attempts: attempts + 1 });
  }

  if (isDone(state)) {
    return (
      <div className={`result ${state.solved ? "ok" : "given"}`} role="status">
        <p className="res-title">
          {state.solved ? "Правильно!" : "Розв'язок"} Відповідь: <strong>{String(p.answer).replace(".", ",")}</strong>
        </p>
        <p className="res-sol"><MathText text={p.solution} /></p>
        {!demo && <p className="res-letter">Літера дня: <b>{PHRASE_LETTERS[p.day - 1]}</b></p>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="adv-answer" className="lbl">Твоя відповідь</label>
      <div className="answer-row">
        <input
          id="adv-answer"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          aria-invalid={!!error}
          aria-describedby={error ? "adv-err" : undefined}
          placeholder="Число"
        />
        <button type="submit" className="btn" disabled={!value.trim()}>Перевірити</button>
      </div>
      {error && <p id="adv-err" className="err" role="alert">{error}</p>}

      <div className="aids">
        {showHint ? (
          <p className="hint"><span>Підказка:</span> <MathText text={p.hint} /></p>
        ) : (
          <button type="button" className="link" onClick={() => setShowHint(true)}>Показати підказку</button>
        )}
        {attempts >= 3 && (
          <button type="button" className="link" onClick={() => onUpdate({ gaveUp: true })}>
            Показати розв&apos;язок
          </button>
        )}
      </div>
    </form>
  );
}

function LockIcon() {
  return (
    <svg className="lock" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
