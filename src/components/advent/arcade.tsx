"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BonusId } from "@/lib/advent";

/**
 * «Ігротека»: bonus games that sit outside the 24 windows. Each one calls `onWin(note)`
 * once; the page stores the win and lets the player go again.
 */
export function BonusGame({ id, onWin }: { id: BonusId; onWin: (note: string) => void }) {
  if (id === "sudoku") return <SudokuGame onWin={onWin} />;
  if (id === "sleigh") return <SleighGame onWin={onWin} />;
  if (id === "lights") return <LightsGame onWin={onWin} />;
  return <ReindeerGame onWin={onWin} />;
}

function rnd(a: number, b: number) { return a + Math.floor(Math.random() * (b - a + 1)); }
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
/** Stable setTimeout that is dropped when the game unmounts. */
function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
}
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/* ---------- «Сніжне судоку» 4×4 ---------- */

const BASE = [
  [1, 2, 3, 4],
  [3, 4, 1, 2],
  [2, 1, 4, 3],
  [4, 3, 2, 1],
];
/** Givens; any valid completion counts as a win. */
const GIVEN = ["0-0", "0-3", "1-1", "2-2", "3-0", "3-3"];

function makeSudoku() {
  const map = shuffle([1, 2, 3, 4]);
  // Relabel digits and optionally transpose: a different-looking grid every time.
  const t = Math.random() < 0.5;
  return BASE.map((row, r) => row.map((_, c) => map[(t ? BASE[c][r] : BASE[r][c]) - 1]));
}

function conflicts(g: number[][]): Set<string> {
  const bad = new Set<string>();
  const groups: [number, number][][] = [];
  for (let i = 0; i < 4; i++) {
    groups.push([0, 1, 2, 3].map((j) => [i, j]));
    groups.push([0, 1, 2, 3].map((j) => [j, i]));
  }
  for (const br of [0, 2]) for (const bc of [0, 2]) groups.push([[br, bc], [br, bc + 1], [br + 1, bc], [br + 1, bc + 1]]);
  for (const cells of groups) {
    const seen = new Map<number, string>();
    for (const [r, c] of cells) {
      const v = g[r][c];
      if (!v) continue;
      const k = `${r}-${c}`;
      if (seen.has(v)) { bad.add(k); bad.add(seen.get(v)!); } else seen.set(v, k);
    }
  }
  return bad;
}

const FLAKE_COLORS = ["", "#7a6ad8", "#2f7d76", "#d2683f", "#14262a"];

function SudokuGame({ onWin }: { onWin: (note: string) => void }) {
  const [solution] = useState(makeSudoku);
  const [grid, setGrid] = useState(() => solution.map((row, r) => row.map((v, c) => (GIVEN.includes(`${r}-${c}`) ? v : 0))));
  const [sel, setSel] = useState<string | null>(null);
  const later = useLater();
  const bad = conflicts(grid);
  const full = grid.every((row) => row.every(Boolean));
  const won = full && bad.size === 0;

  function put(v: number) {
    if (!sel || won) return;
    const [r, c] = sel.split("-").map(Number);
    const g = grid.map((row) => [...row]);
    g[r][c] = v;
    setGrid(g);
    if (g.every((row) => row.every(Boolean)) && conflicts(g).size === 0) later(() => onWin("Судоку розв'язано"), 800);
  }

  return (
    <div className="game sudoku">
      <div className={`sd-grid${won ? " won" : ""}`} role="grid" aria-label="Судоку 4 на 4">
        {grid.map((row, r) => row.map((v, c) => {
          const k = `${r}-${c}`;
          const fixed = GIVEN.includes(k);
          return (
            <button key={k} type="button" role="gridcell"
              className={`sd-cell${fixed ? " given" : ""}${sel === k ? " sel" : ""}${bad.has(k) ? " bad" : ""}${c === 1 ? " br" : ""}${r === 1 ? " bb" : ""}`}
              disabled={fixed || won}
              onClick={() => setSel(k)}
              aria-label={`Рядок ${r + 1}, стовпець ${c + 1}: ${v || "порожньо"}`}
              style={v ? { color: FLAKE_COLORS[v] } : undefined}>
              {v || ""}
            </button>
          );
        }))}
      </div>
      <div className="sd-pad" aria-label="Цифри">
        {[1, 2, 3, 4].map((v) => (
          <button key={v} type="button" disabled={!sel || won} onClick={() => put(v)} style={{ color: FLAKE_COLORS[v] }}>{v}</button>
        ))}
        <button type="button" disabled={!sel || won} onClick={() => put(0)} aria-label="Стерти">⌫</button>
      </div>
      <p className="game-tip" role="status">
        {won ? "Готово!" : bad.size ? "Є повтор — він підсвічений червоним." : sel ? "Обери цифру." : "Торкнися порожньої клітинки."}
      </p>
    </div>
  );
}

/* ---------- «Сани Миколая»: catch the right gifts ---------- */

const LANES = 5;
const SLEIGH_GOAL = 10;
const RULES = [
  { label: "кратні 3", ok: (n: number) => n % 3 === 0 },
  { label: "кратні 4", ok: (n: number) => n % 4 === 0 },
];
interface Gift { id: number; lane: number; y: number; n: number }

function SleighGame({ onWin }: { onWin: (note: string) => void }) {
  const [rule] = useState(() => RULES[rnd(0, RULES.length - 1)]);
  const [phase, setPhase] = useState<"ready" | "playing" | "lost" | "won">("ready");
  const [lane, setLane] = useState(2);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [flash, setFlash] = useState<{ lane: number; ok: boolean; id: number } | null>(null);
  const st = useRef({ lane: 2, gifts: [] as Gift[], score: 0, lives: 3, seq: 0, t: 0 });
  const later = useLater();
  const onWinRef = useRef(onWin);
  useEffect(() => { onWinRef.current = onWin; });

  function start() {
    st.current = { lane: 2, gifts: [], score: 0, lives: 3, seq: 0, t: 0 };
    setLane(2); setGifts([]); setScore(0); setLives(3); setPhase("playing");
  }
  function move(d: number) {
    const l = Math.max(0, Math.min(LANES - 1, st.current.lane + d));
    st.current.lane = l; setLane(l);
  }
  function goTo(l: number) { st.current.lane = l; setLane(l); }

  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      const s = st.current;
      s.t += 1;
      const speed = 1.1 + s.score * 0.08;
      if (s.t % Math.max(14, 24 - s.score) === 0) {
        // About half the gifts follow the rule.
        let n = rnd(10, 99);
        if (Math.random() < 0.5) while (!rule.ok(n)) n = rnd(10, 99);
        s.gifts.push({ id: ++s.seq, lane: rnd(0, LANES - 1), y: -8, n });
      }
      const keep: Gift[] = [];
      for (const g of s.gifts) {
        g.y += speed;
        if (g.y >= 82 && g.y < 82 + speed && g.lane === s.lane) {
          const ok = rule.ok(g.n);
          if (ok) s.score += 1; else s.lives -= 1;
          setFlash({ lane: g.lane, ok, id: g.id });
          continue;
        }
        if (g.y < 104) keep.push(g);
      }
      s.gifts = keep;
      setGifts(keep.map((g) => ({ ...g })));
      setScore(s.score);
      setLives(s.lives);
      if (s.lives <= 0) { setPhase("lost"); return; }
      if (s.score >= SLEIGH_GOAL) {
        setPhase("won");
        s.gifts = []; setGifts([]);
        const lost = 3 - s.lives;
        later(() => onWinRef.current(lost ? `10 подарунків, зайвих: ${lost}` : "10 подарунків без жодного зайвого"), 600);
      }
    }, 40);
    return () => window.clearInterval(id);
  }, [phase, rule, later]);

  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
      if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  return (
    <div className="game sleigh">
      <p className="game-bar">
        <span>Лови: <b>{rule.label}</b></span>
        <span>Подарунків: <b>{score} з {SLEIGH_GOAL}</b> · Життя: <b>{"❤".repeat(Math.max(0, lives))}</b></span>
      </p>
      <div className="sl-field">
        {Array.from({ length: LANES }, (_, l) => (
          <button key={l} type="button" className="sl-lane" aria-label={`Доріжка ${l + 1}`} tabIndex={-1}
            disabled={phase !== "playing"} onClick={() => goTo(l)} />
        ))}
        {gifts.map((g) => (
          <span key={g.id} className="sl-gift" style={{ left: `${(g.lane + 0.5) * (100 / LANES)}%`, top: `${g.y}%` }}>{g.n}</span>
        ))}
        <span className={`sl-sleigh${flash ? (flash.ok ? " ok" : " no") : ""}`} key={flash?.id ?? "s"}
          style={{ left: `${(lane + 0.5) * (100 / LANES)}%` }} aria-hidden>
          <svg viewBox="0 0 64 32"><path d="M6 6h6v14h36c6 0 10-4 10-10h4c0 8-6 16-14 16H8a6 6 0 0 1-2-12z" /><path d="M4 28h50c3 0 5-2 6-4" fill="none" strokeWidth="3" /></svg>
        </span>
        {(phase === "ready" || phase === "lost") && (
          <div className="sky-msg">
            <p>{phase === "lost" ? `Сани перевантажені. Подарунків: ${score}.` : `Лови лише ${rule.label}. Стрілки ← → або торкайся доріжки.`}</p>
            <button type="button" className="btn" onClick={start}>{phase === "lost" ? "Ще раз" : "Почати"}</button>
          </div>
        )}
      </div>
      <div className="sl-controls">
        <button type="button" className="ball" disabled={phase !== "playing"} onClick={() => move(-1)} aria-label="Ліворуч">←</button>
        <button type="button" className="ball" disabled={phase !== "playing"} onClick={() => move(1)} aria-label="Праворуч">→</button>
      </div>
    </div>
  );
}

/* ---------- «Вікна у Святвечір»: lights out 3×3 ---------- */

const N = 3;
function press(g: boolean[], i: number): boolean[] {
  const r = Math.floor(i / N), c = i % N;
  const next = [...g];
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) next[rr * N + cc] = !next[rr * N + cc];
  }
  return next;
}
function makeLights(): boolean[] {
  // Start from all lit and undo a few presses: always solvable.
  let g = Array<boolean>(N * N).fill(true);
  const k = rnd(3, 5);
  for (const i of shuffle([...Array(N * N).keys()]).slice(0, k)) g = press(g, i);
  return g.every(Boolean) ? press(g, 4) : g;
}

function LightsGame({ onWin }: { onWin: (note: string) => void }) {
  const [start, setStart] = useState(makeLights);
  const [g, setG] = useState(start);
  const [moves, setMoves] = useState(0);
  const later = useLater();
  const won = g.every(Boolean);

  function tap(i: number) {
    if (won) return;
    const next = press(g, i);
    setG(next);
    setMoves(moves + 1);
    if (next.every(Boolean)) later(() => onWin(`Усі вікна світяться за ${moves + 1} ${plural(moves + 1, "хід", "ходи", "ходів")}`), 900);
  }

  return (
    <div className="game lights">
      <p className="game-bar">
        <span>Світиться: <b>{g.filter(Boolean).length} з {N * N}</b></span>
        <span>Ходів: <b>{moves}</b></span>
      </p>
      <div className={`house${won ? " won" : ""}`}>
        <svg className="roof" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 60 L100 4 L200 60z" />
          <path className="snowcap" d="M28 44 L100 4 L172 44 Q160 40 150 46 Q138 38 126 44 Q112 36 100 42 Q88 36 74 44 Q62 38 50 46 Q40 40 28 44z" />
        </svg>
        <div className="windows">
          {g.map((on, i) => (
            <button key={i} type="button" className={`win${on ? " on" : ""}`} onClick={() => tap(i)}
              aria-pressed={on} aria-label={`Вікно ${i + 1}, ${on ? "світиться" : "темне"}`}>
              <span aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <p className="game-tip">Торкання перемикає вікно і його сусідів зверху, знизу, ліворуч і праворуч.</p>
      {!won && moves > 0 && (
        <button type="button" className="link" onClick={() => { const s = makeLights(); setStart(s); setG(s); setMoves(0); }}>
          Новий будинок
        </button>
      )}
    </div>
  );
}

/* ---------- «Шлях оленя»: reach the target with operations ---------- */

type Op = { label: string; f: (x: number) => number };
const OPS: Record<string, Op> = {
  x2: { label: "×2", f: (x) => x * 2 },
  p3: { label: "+3", f: (x) => x + 3 },
  p5: { label: "+5", f: (x) => x + 5 },
  m1: { label: "−1", f: (x) => x - 1 },
  x10: { label: "×10", f: (x) => x * 10 },
  p1: { label: "+1", f: (x) => x + 1 },
};
// Shortest paths: 3, 5 and 9 moves (checked with BFS).
const ROUTES = [
  { start: 1, target: 11, ops: ["x2", "p3"], limit: 4 },
  { start: 3, target: 50, ops: ["x2", "p5", "m1"], limit: 6 },
  { start: 1, target: 2027, ops: ["x10", "p1", "x2"], limit: 10 },
];

function ReindeerGame({ onWin }: { onWin: (note: string) => void }) {
  const [round, setRound] = useState(0);
  const [trail, setTrail] = useState<number[]>([ROUTES[0].start]);
  const later = useLater();
  const R = ROUTES[round];
  const cur = trail[trail.length - 1];
  const used = trail.length - 1;
  const reached = cur === R.target;
  const out = !reached && used >= R.limit;

  function apply(k: string) {
    if (reached || out) return;
    const v = OPS[k].f(cur);
    const next = [...trail, v];
    setTrail(next);
    if (v === R.target) {
      later(() => {
        if (round + 1 < ROUTES.length) { setRound(round + 1); setTrail([ROUTES[round + 1].start]); }
        else onWin("Олень дійшов до 2027");
      }, 1000);
    }
  }

  return (
    <div className="game reindeer">
      <p className="game-bar">
        <span>Маршрут <b>{round + 1} з {ROUTES.length}</b></span>
        <span>Ходів: <b className={out ? "over" : ""}>{used} з {R.limit}</b></span>
      </p>
      <div className="rd-track">
        <span className="rd-from">{R.start}</span>
        <span className="rd-road" aria-hidden>
          {Array.from({ length: R.limit }, (_, i) => <i key={i} className={i < used ? "done" : ""} />)}
        </span>
        <span className={`rd-to${reached ? " hit" : ""}`}>{R.target}</span>
      </div>
      <p className="rd-now" aria-live="polite">
        <span className="rd-deer" aria-hidden>🦌</span> <b>{cur}</b>
      </p>
      <p className="rd-trail">{trail.join(" → ")}</p>
      <div className="rd-ops">
        {R.ops.map((k) => (
          <button key={k} type="button" className="ball" disabled={reached || out} onClick={() => apply(k)}>{OPS[k].label}</button>
        ))}
      </div>
      <div className="aids">
        <button type="button" className="link" disabled={used === 0 || reached} onClick={() => setTrail(trail.slice(0, -1))}>Крок назад</button>
        <button type="button" className="link" disabled={used === 0 || reached} onClick={() => setTrail([R.start])}>Спочатку</button>
      </div>
      {out && <p className="game-tip" role="status">Ходи скінчилися. Зроби крок назад або почни маршрут спочатку.</p>}
    </div>
  );
}
