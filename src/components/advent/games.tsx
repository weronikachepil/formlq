"use client";

import { useEffect, useRef, useState } from "react";
import { MathText } from "@/components/MathText";
import type { GameId } from "@/lib/advent";

/**
 * Sunday mini-games for the advent calendar. Each one calls `onWin(note)` once, where
 * `note` is a short summary shown with the day's letter («За 9 ходів»).
 */
export function Game({ id, onWin }: { id: GameId; onWin: (note: string) => void }) {
  if (id === "memory") return <MemoryGame onWin={onWin} />;
  if (id === "snowballs") return <SnowballGame onWin={onWin} />;
  if (id === "snowman") return <SnowmanGame onWin={onWin} />;
  if (id === "tree") return <TreeGame onWin={onWin} />;
  if (id === "lake") return <LakeGame onWin={onWin} />;
  return <GarlandGame onWin={onWin} />;
}

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** setTimeout that is dropped when the game unmounts (dialog closed mid-animation). */
function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/* ---------- 6 Dec · «Подарунки Миколая»: memory pairs ---------- */

const PAIRS: [string, string][] = [
  ["$2^5$", "$32$"],
  ["$\\sqrt{81}$", "$9$"],
  ["$\\log_3 27$", "$3$"],
  ["$\\sin 30^\\circ$", "$\\dfrac12$"],
  ["$5!$", "$120$"],
  ["$20\\%$ від $50$", "$10$"],
];

function MemoryGame({ onWin }: { onWin: (note: string) => void }) {
  const [cards] = useState(() => shuffle(PAIRS.flatMap(([a, b], pair) => [{ pair, face: a }, { pair, face: b }])));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [moves, setMoves] = useState(0);
  const later = useLater();

  function flip(i: number) {
    if (open.length === 2 || open.includes(i) || matched.has(cards[i].pair)) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    const m = moves + 1;
    setMoves(m);
    const [a, b] = next;
    if (cards[a].pair === cards[b].pair) {
      const done = new Set(matched).add(cards[a].pair);
      setMatched(done);
      setOpen([]);
      if (done.size === PAIRS.length) later(() => onWin(`Усі пари за ${m} ${plural(m, "хід", "ходи", "ходів")}`), 700);
    } else {
      later(() => setOpen([]), 900);
    }
  }

  return (
    <div className="game memory">
      <p className="game-bar">
        <span>Пар: <b>{matched.size} з {PAIRS.length}</b></span>
        <span>Ходів: <b>{moves}</b></span>
      </p>
      <div className="mem-grid">
        {cards.map((c, i) => {
          const shown = open.includes(i) || matched.has(c.pair);
          return (
            <button
              key={i}
              type="button"
              className={`mem-card${shown ? " shown" : ""}${matched.has(c.pair) ? " matched" : ""}`}
              onClick={() => flip(i)}
              aria-label={shown ? undefined : `Подарунок ${i + 1}, закритий`}
              aria-pressed={shown}
            >
              <span className="mem-inner">
                <span className="mem-back" aria-hidden><Bow /></span>
                <span className="mem-face">{shown && <MathText text={c.face} />}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Bow() {
  return (
    <svg viewBox="0 0 40 24" className="bow">
      <path d="M20 12C14 2 4 2 6 9s10 5 14 3zM20 12c6-10 16-10 14-3s-10 5-14 3z" />
      <circle cx="20" cy="12" r="3.2" />
    </svg>
  );
}

/* ---------- 13 Dec · «Сніжинки»: quick mental arithmetic ---------- */

const GOAL = 10;
const LIVES = 3;

interface Flake { key: number; q: string; answer: number; options: number[]; ms: number }

function rnd(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }

function makeFlake(key: number, score: number): Flake {
  const kinds: (() => [string, number])[] = [
    () => { const a = rnd(3, 12), b = rnd(3, 12); return [`$${a} \\cdot ${b}$`, a * b]; },
    () => { const a = rnd(12, 89), b = rnd(11, 59); return [`$${a} + ${b}$`, a + b]; },
    () => { const a = rnd(40, 99), b = rnd(11, 39); return [`$${a} - ${b}$`, a - b]; },
    () => { const a = rnd(11, 19); return [`$${a}^2$`, a * a]; },
    () => { const p = [10, 20, 25, 50][rnd(0, 3)], n = rnd(2, 9) * 20; return [`$${p}\\%$ від $${n}$`, (n * p) / 100]; },
    () => { const b = rnd(3, 9), q = rnd(3, 12); return [`$${b * q} : ${b}$`, q]; },
  ];
  const [q, answer] = kinds[rnd(0, kinds.length - 1)]();
  const opts = new Set([answer]);
  const deltas = shuffle([-10, -2, -1, 1, 2, 10]);
  for (const d of deltas) { if (opts.size === 3) break; if (answer + d > 0) opts.add(answer + d); }
  // Faster as the score grows: 7 s at the start, 4 s near the end.
  return { key, q, answer, options: shuffle([...opts]), ms: Math.max(4000, 7000 - score * 330) };
}

function SnowballGame({ onWin }: { onWin: (note: string) => void }) {
  const [phase, setPhase] = useState<"ready" | "playing" | "lost">("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [mistakes, setMistakes] = useState(0);
  const [flake, setFlake] = useState<Flake | null>(null);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const later = useLater();
  const seq = useRef(0);
  const next = (sc: number) => makeFlake(++seq.current, sc);

  function start() {
    setScore(0); setLives(LIVES); setMistakes(0); setFlash(null);
    setFlake(next(0));
    setPhase("playing");
  }

  function lose() {
    setFlash("miss");
    setMistakes((m) => m + 1);
    const left = lives - 1;
    setLives(left);
    if (left === 0) { setPhase("lost"); setFlake(null); return; }
    setFlake(next(score));
  }

  function pick(v: number) {
    if (!flake || phase !== "playing") return;
    if (v !== flake.answer) { lose(); return; }
    const s = score + 1;
    setScore(s);
    setFlash("hit");
    if (s >= GOAL) {
      setFlake(null);
      later(() => onWin(mistakes ? `10 влучань, ${mistakes} ${plural(mistakes, "промах", "промахи", "промахів")}` : "10 влучань без жодного промаху"), 500);
      return;
    }
    setFlake(next(s));
  }

  // The flake «melts» when its time runs out. Keyed by flake so each one gets its own timer.
  const loseRef = useRef(lose);
  useEffect(() => { loseRef.current = lose; });
  useEffect(() => {
    if (phase !== "playing" || !flake) return;
    const t = window.setTimeout(() => loseRef.current(), flake.ms);
    return () => window.clearTimeout(t);
  }, [phase, flake]);

  return (
    <div className="game snow">
      <p className="game-bar">
        <span>Влучань: <b>{score} з {GOAL}</b></span>
        <span aria-label={`Життя: ${lives}`}>
          {Array.from({ length: LIVES }, (_, i) => (
            <Snowflake key={i} className={`life${i < lives ? "" : " gone"}`} />
          ))}
        </span>
      </p>
      <div className={`sky${flash ? ` ${flash}` : ""}`} onAnimationEnd={() => setFlash(null)}>
        {phase === "ready" && (
          <div className="sky-msg">
            <p>Сніжинки падають усе швидше.</p>
            <button type="button" className="btn" onClick={start}>Почати</button>
          </div>
        )}
        {phase === "lost" && (
          <div className="sky-msg">
            <p>Сніжинки розтанули. Влучань: {score}.</p>
            <button type="button" className="btn" onClick={start}>Ще раз</button>
          </div>
        )}
        {phase === "playing" && flake && (
          <div key={flake.key} className="flake" style={{ ["--fall" as string]: `${flake.ms}ms`, left: `${10 + ((flake.key * 37) % 60)}%` }}>
            <MathText text={flake.q} />
          </div>
        )}
        {phase === "playing" && flake && <span key={`t${flake.key}`} className="timer" style={{ ["--fall" as string]: `${flake.ms}ms` }} />}
      </div>
      <div className="snowballs" aria-label="Варіанти відповіді">
        {(flake?.options ?? [0, 0, 0]).map((v, i) => (
          <button key={i} type="button" className="ball" disabled={phase !== "playing" || !flake} onClick={() => pick(v)}>
            {flake ? v : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function Snowflake({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5" />
    </svg>
  );
}

/* ---------- 20 Dec · «Гірлянда»: order numbers ---------- */

const LAMPS = [
  { t: "$\\tfrac52$", v: 2.5 },
  { t: "$\\sqrt8$", v: Math.sqrt(8) },
  { t: "$2{,}9$", v: 2.9 },
  { t: "$\\pi$", v: Math.PI },
  { t: "$\\log_2 10$", v: Math.log2(10) },
  { t: "$\\sqrt{12}$", v: Math.sqrt(12) },
];
const LAMP_COLORS = ["#f4c430", "#cfc6f7", "#bfe0dd", "#ffb48a", "#cfc6f7", "#f4c430"];

function GarlandGame({ onWin }: { onWin: (note: string) => void }) {
  const [order] = useState(() => shuffle(LAMPS.map((_, i) => i)));
  const ranks = [...LAMPS].map((l, i) => ({ i, v: l.v })).sort((a, b) => a.v - b.v).map((x) => x.i);
  const [lit, setLit] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const later = useLater();

  function tap(i: number) {
    const rank = ranks.indexOf(i);
    if (rank < lit) return;
    if (rank === lit) {
      const n = lit + 1;
      setLit(n);
      if (n === LAMPS.length) {
        later(() => onWin(mistakes ? `Гірлянда засвічена, помилок: ${mistakes}` : "Гірлянда засвічена без помилок"), 1200);
      }
      return;
    }
    setMistakes((m) => m + 1);
    setShake(i);
    later(() => setShake(null), 450);
  }

  const done = lit === LAMPS.length;
  return (
    <div className="game garland">
      <p className="game-bar">
        <span>Засвічено: <b>{lit} з {LAMPS.length}</b></span>
        <span>Помилок: <b>{mistakes}</b></span>
      </p>
      <div className={`wire${done ? " all-lit" : ""}`}>
        {order.map((i) => {
          const rank = ranks.indexOf(i);
          const on = rank < lit;
          return (
            <div className="lamp-cell" key={i}>
              <button
                type="button"
                className={`lamp${on ? " on" : ""}${shake === i ? " shake" : ""}`}
                style={{ ["--glow" as string]: LAMP_COLORS[rank] }}
                onClick={() => tap(i)}
                aria-pressed={on}
              >
                <span className="cap" aria-hidden />
                <span className="bulb"><MathText text={LAMPS[i].t} /></span>
                {on && <span className="ord" aria-label={`${rank + 1}-а`}>{rank + 1}</span>}
              </button>
            </div>
          );
        })}
      </div>
      {mistakes >= 2 && !done && (
        <p className="hint"><span>Підказка:</span> <MathText text="$\pi \approx 3{,}14$, $\sqrt8 \approx 2{,}83$, $\sqrt{12} \approx 3{,}46$, $\log_2 10 \approx 3{,}32$." /></p>
      )}
    </div>
  );
}

/* ---------- 5 Dec · «Сніговик»: guess the term, letter by letter ---------- */

const WORDS: [string, string][] = [
  ["ГІПОТЕНУЗА", "Сторона прямокутного трикутника навпроти прямого кута"],
  ["ЛОГАРИФМ", "Показник степеня, до якого треба піднести основу, щоб отримати число"],
  ["ДИСКРИМІНАНТ", "Вираз $b^2 - 4ac$"],
  ["БІСЕКТРИСА", "Промінь, що ділить кут навпіл"],
  ["ПАРАБОЛА", "Графік функції $y = x^2$"],
  ["ПОХІДНА", "Миттєва швидкість зміни функції"],
  ["ІНТЕГРАЛ", "Площа під графіком функції"],
  ["ПРОГРЕСІЯ", "Послідовність, де кожен член більший за попередній на те саме число (або в те саме число разів)"],
];
const ALPHABET = [..."АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ"];
const MAX_MISSES = 6;

function SnowmanGame({ onWin }: { onWin: (note: string) => void }) {
  const [round, setRound] = useState(() => ({ word: WORDS[rnd(0, WORDS.length - 1)], guessed: new Set<string>() }));
  const later = useLater();
  const [word, clue] = round.word;
  const misses = [...round.guessed].filter((l) => !word.includes(l)).length;
  const won = [...word].every((l) => round.guessed.has(l));
  const lost = misses >= MAX_MISSES;

  function guess(l: string) {
    if (won || lost || round.guessed.has(l)) return;
    const g = new Set(round.guessed).add(l);
    setRound({ ...round, guessed: g });
    const m = [...g].filter((x) => !word.includes(x)).length;
    if ([...word].every((x) => g.has(x))) {
      later(() => onWin(m ? `Слово «${word.toLowerCase()}», помилок: ${m}` : `Слово «${word.toLowerCase()}» без жодної помилки`), 900);
    }
  }
  function restart() {
    const others = WORDS.filter((w) => w[0] !== word);
    setRound({ word: others[rnd(0, others.length - 1)], guessed: new Set() });
  }

  return (
    <div className="game snowman">
      <p className="game-bar">
        <span>Помилок: <b>{misses} з {MAX_MISSES}</b></span>
      </p>
      <div className="sm-stage">
        <SnowmanSvg parts={MAX_MISSES - misses} />
        <div className="sm-word-wrap">
          <p className="sm-clue"><MathText text={clue} /></p>
          <p className="sm-word" aria-label={won || lost ? word : `Слово з ${word.length} літер`}>
            {[...word].map((l, i) => (
              <span key={i} className={round.guessed.has(l) ? "hit" : lost ? "reveal" : ""}>
                {round.guessed.has(l) || lost ? l : ""}
              </span>
            ))}
          </p>
        </div>
      </div>
      {lost ? (
        <div className="game-lost">
          <p>Сніговик розтанув. Спробуй інше слово!</p>
          <button type="button" className="btn" onClick={restart}>Ще раз</button>
        </div>
      ) : (
        <div className="sm-keys" aria-label="Літери">
          {ALPHABET.map((l) => {
            const used = round.guessed.has(l);
            return (
              <button key={l} type="button" disabled={used || won}
                className={used ? (word.includes(l) ? "ok" : "no") : ""}
                onClick={() => guess(l)}>{l}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Parts melt in this order: hat, nose, scarf, head, middle, base. */
function SnowmanSvg({ parts }: { parts: number }) {
  const show = (k: number) => parts > MAX_MISSES - 1 - k;
  return (
    <svg className="sm-svg" viewBox="0 0 120 170" aria-hidden>
      <ellipse cx="60" cy="162" rx={20 + (MAX_MISSES - parts) * 7} ry="5" className="puddle" />
      {show(5) && <circle cx="60" cy="130" r="30" className="snow" />}
      {show(4) && <circle cx="60" cy="86" r="22" className="snow" />}
      {show(4) && <><circle cx="60" cy="80" r="2" className="coal" /><circle cx="60" cy="92" r="2" className="coal" /></>}
      {show(3) && <circle cx="60" cy="50" r="17" className="snow" />}
      {show(3) && <><circle cx="54" cy="46" r="2" className="coal" /><circle cx="66" cy="46" r="2" className="coal" /></>}
      {show(2) && <path d="M42 64 Q60 72 78 64 L80 70 Q60 79 40 70z M70 68 l6 18 l-7 1 l-4-16z" className="scarf" />}
      {show(1) && <path d="M60 52 L76 56 L60 57z" className="carrot" />}
      {show(0) && <path d="M44 36 H76 V33 H70 V14 H50 V33 H44z" className="hat" />}
    </svg>
  );
}

/* ---------- 12 Dec · «Ялинка 2027»: subset sum ---------- */

const TREE_ROUNDS: { target: number; balls: number[] }[] = [
  { target: 20, balls: [7, 4, 9, 13, 6, 2] },
  { target: 50, balls: [12, 25, 8, 17, 30, 5, 14] },
  { target: 2027, balls: [1000, 999, 27, 1001, 26, 500, 2000] },
];
const SLOTS: [number, number][] = [[50, 30], [38, 47], [62, 47], [30, 64], [50, 62], [70, 64], [42, 80]];
const BALL_COLORS = ["#ffb48a", "#cfc6f7", "#f4c430", "#bfe0dd", "#ff8d6b", "#cfc6f7", "#f4c430"];

function TreeGame({ onWin }: { onWin: (note: string) => void }) {
  const [round, setRound] = useState(0);
  const [hung, setHung] = useState<number[]>([]);
  const [tries, setTries] = useState(0);
  const later = useLater();
  const { target, balls } = TREE_ROUNDS[round];
  const sum = hung.reduce((a, i) => a + balls[i], 0);
  const solved = sum === target;

  function toggle(i: number) {
    if (solved) return;
    const next = hung.includes(i) ? hung.filter((x) => x !== i) : [...hung, i];
    setHung(next);
    setTries((t) => t + 1);
    if (next.reduce((a, k) => a + balls[k], 0) === target) {
      later(() => {
        if (round + 1 < TREE_ROUNDS.length) { setRound(round + 1); setHung([]); }
        else onWin("Усі три ялинки прикрашено");
      }, 1100);
    }
  }

  return (
    <div className="game tree">
      <p className="game-bar">
        <span>Ялинка <b>{round + 1} з {TREE_ROUNDS.length}</b></span>
        <span>Сума: <b className={sum > target ? "over" : solved ? "eq" : ""}>{sum}</b> / {target}</span>
      </p>
      <div className={`tree-stage${solved ? " solved" : ""}`}>
        <svg viewBox="0 0 100 100" className="tree-svg" aria-hidden>
          <path d="M50 14 L74 44 H62 L82 72 H66 L88 94 H12 L34 72 H18 L38 44 H26z" className="needles" />
          <rect x="45" y="94" width="10" height="6" className="trunk" />
          {hung.map((b, k) => {
            const [x, y] = SLOTS[k % SLOTS.length];
            return (
              <g key={b} className="hung">
                <circle cx={x} cy={y} r="7" fill={BALL_COLORS[b]} />
                <text x={x} y={y + 2.2} textAnchor="middle">{balls[b]}</text>
              </g>
            );
          })}
        </svg>
        <span className="tree-star" aria-label={`Ціль: ${target}`}>{target}</span>
      </div>
      <div className="tree-balls" aria-label="Кулі">
        {balls.map((v, i) => (
          <button key={`${round}-${i}`} type="button" aria-pressed={hung.includes(i)}
            className={`tball${hung.includes(i) ? " on" : ""}`}
            style={{ ["--ball" as string]: BALL_COLORS[i] }}
            onClick={() => toggle(i)}>
            <span className="loop" aria-hidden />{v}
          </button>
        ))}
      </div>
      <p className="game-tip">{solved ? "Є! Ялинка готова." : sum > target ? "Забагато — зніми якусь кулю." : `Кількість дій: ${tries}`}</p>
    </div>
  );
}

/* ---------- 19 Dec · «Крига»: walk on primes ---------- */

const LAKE = [
  [21, 2, 15, 9, 25],
  [49, 3, 5, 27, 33],
  [8, 10, 7, 12, 1],
  [39, 23, 11, 4, 51],
  [17, 19, 6, 35, 57],
];
function isPrime(n: number) { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }
function why(n: number) {
  if (n < 2) return `${n} — не просте й не складене`;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return `${n} = ${d}·${n / d}`;
  return "";
}

function LakeGame({ onWin }: { onWin: (note: string) => void }) {
  const [path, setPath] = useState<[number, number][]>([]);
  const [cracked, setCracked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("Почни з будь-якої крижини в нижньому ряду.");
  const later = useLater();
  const last = path[path.length - 1];
  const done = !!last && last[0] === 0;

  function step(r: number, c: number) {
    if (done || path.some(([pr, pc]) => pr === r && pc === c)) return;
    const n = LAKE[r][c];
    const near = last ? Math.abs(last[0] - r) + Math.abs(last[1] - c) === 1 : r === LAKE.length - 1;
    if (!near) { setMsg(last ? "Стрибати не можна — лише на сусідню крижину." : "Почни з нижнього ряду."); return; }
    if (!isPrime(n)) {
      setCracked(new Set(cracked).add(`${r}-${c}`));
      setMsg(`Тріск! ${why(n)}.`);
      return;
    }
    const next = [...path, [r, c] as [number, number]];
    setPath(next);
    if (r === 0) {
      setMsg("Ти на тому березі!");
      const m = cracked.size;
      later(() => onWin(m ? `Озеро перейдено, тріснуло крижин: ${m}` : "Озеро перейдено, жодна крижина не тріснула"), 900);
    } else setMsg(`${n} — просте. Далі!`);
  }

  return (
    <div className="game lake">
      <p className="game-bar">
        <span>Кроків: <b>{path.length}</b></span>
        <span>Тріщин: <b>{cracked.size}</b></span>
      </p>
      <p className="lake-shore top" aria-hidden>Берег</p>
      <div className="lake-grid" role="grid" aria-label="Озеро">
        {LAKE.map((row, r) => row.map((n, c) => {
          const onPath = path.findIndex(([pr, pc]) => pr === r && pc === c);
          const isLast = last && last[0] === r && last[1] === c;
          const crack = cracked.has(`${r}-${c}`);
          return (
            <button key={`${r}-${c}`} type="button" role="gridcell"
              className={`ice${onPath >= 0 ? " path" : ""}${isLast ? " here" : ""}${crack ? " crack" : ""}`}
              onClick={() => step(r, c)} disabled={crack}
              aria-label={`${n}${onPath >= 0 ? ", пройдено" : crack ? ", тріснула" : ""}`}>
              {n}
              {isLast && <span className="steps" aria-hidden>🐾</span>}
            </button>
          );
        }))}
      </div>
      <p className="lake-shore" aria-hidden>Старт</p>
      <p className="game-tip" role="status">{msg}</p>
      {path.length > 0 && !done && (
        <button type="button" className="link" onClick={() => { setPath([]); setMsg("Почни з будь-якої крижини в нижньому ряду."); }}>
          Почати спочатку
        </button>
      )}
    </div>
  );
}
