"use client";

import { useState, useSyncExternalStore } from "react";
import confetti from "canvas-confetti";
import { ADVENT_YEAR } from "@/lib/advent";
import { CASE_ENDING, CASE_INTRO, CLUES, CULPRIT, SUSPECTS, type Suspect } from "@/lib/advent-case";
import { HEROES, heroDays } from "@/lib/advent-map";

/**
 * «Різдвяна справа»: the clue board under the adventure map. Each opened stop gives a clue;
 * the player crosses suspects out and, with all twelve clues, names the culprit. A wrong
 * guess says which clue that suspect fails. Crossings and the result live in this browser.
 */

interface CaseState { crossed: string[]; solved?: boolean }
const KEY = `formlq-advent-${ADVENT_YEAR}-case`;
const listeners = new Set<() => void>();
let mem: string | null = null;
function read(): string {
  if (mem !== null) return mem;
  try { mem = localStorage.getItem(KEY) ?? "{}"; } catch { mem = "{}"; }
  return mem;
}
function write(s: CaseState) {
  mem = JSON.stringify(s);
  try { localStorage.setItem(KEY, mem); } catch { /* private mode */ }
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function useCase(): CaseState {
  const raw = useSyncExternalStore(subscribe, read, () => "{}");
  try { const s = JSON.parse(raw); return { crossed: s.crossed ?? [], solved: !!s.solved }; } catch { return { crossed: [] }; }
}

export function AdventCase({ isSolved }: { isSolved: (day: number) => boolean }) {
  const state = useCase();
  const found = HEROES.filter((h) => heroDays(h).every(isSolved)).map((h) => h.n);
  const all = found.length === CLUES.length;
  const [pick, setPick] = useState("");
  const [verdict, setVerdict] = useState<string | null>(null);

  function toggle(id: string) {
    const crossed = state.crossed.includes(id) ? state.crossed.filter((x) => x !== id) : [...state.crossed, id];
    write({ ...state, crossed });
  }

  function accuse() {
    if (!pick) return;
    if (pick === CULPRIT) {
      write({ ...state, solved: true });
      setVerdict(null);
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.7 }, disableForReducedMotion: true,
        colors: ["#cfc6f7", "#bfe0dd", "#ffddc4", "#f4c430", "#14262a"] });
      return;
    }
    const s = SUSPECTS.find((x) => x.id === pick)!;
    const miss = CLUES.find((c) => !c.test(s))!;
    setVerdict(`Не сходиться: ${s.name} не підходить під доказ №${miss.n} — «${miss.text}»`);
  }

  return (
    <div className="adv-case card">
      <p className="adv-demo-tag">Детективна історія</p>
      <h2 className="adv-h2">Різдвяна справа: хто сховав зірку?</h2>
      <p className="adv-case-intro">{CASE_INTRO}</p>

      <div className="adv-case-grid">
        <div>
          <h3>Докази · {found.length} з {CLUES.length}</h3>
          <ol className="adv-clues">
            {CLUES.map((c) => {
              const h = HEROES[c.n - 1];
              const [a, b] = heroDays(h);
              const have = found.includes(c.n);
              return (
                <li key={c.n} className={have ? "have" : ""}>
                  <span className="cn">{c.n}</span>
                  {have ? (
                    <span><b>{h.name.split(" ").slice(-1)[0]}:</b> {c.text}</span>
                  ) : (
                    <span className="muted">Відкриється на зупинці {c.n} (дні {a}–{b})</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <h3>Підозрювані</h3>
          <p className="adv-case-hint">Торкнись картки, щоб закреслити того, хто не підходить під докази.</p>
          <ul className="adv-suspects">
            {SUSPECTS.map((s) => (
              <SuspectCard key={s.id} s={s} crossed={state.crossed.includes(s.id)}
                solved={!!state.solved} onToggle={() => toggle(s.id)} />
            ))}
          </ul>
        </div>
      </div>

      {state.solved ? (
        <div className="result ok adv-case-end" role="status">
          <p className="res-title">Справу розкрито! 🌟</p>
          <p className="res-sol">{CASE_ENDING}</p>
        </div>
      ) : all ? (
        <div className="adv-accuse">
          <label htmlFor="adv-accuse" className="lbl">Усі докази зібрано. Хто сховав зірку?</label>
          <div className="answer-row">
            <select id="adv-accuse" value={pick} onChange={(e) => { setPick(e.target.value); setVerdict(null); }}>
              <option value="">Обери підозрюваного</option>
              {SUSPECTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
            </select>
            <button type="button" className="btn" disabled={!pick} onClick={accuse}>Звинуватити</button>
          </div>
          {verdict && <p className="err" role="alert">{verdict}</p>}
        </div>
      ) : (
        <p className="adv-case-hint">Назвати злодія можна, коли зібрано всі {CLUES.length} доказів.</p>
      )}
    </div>
  );
}

function SuspectCard({ s, crossed, solved, onToggle }: { s: Suspect; crossed: boolean; solved: boolean; onToggle: () => void }) {
  const culprit = solved && s.id === CULPRIT;
  return (
    <li>
      <button type="button" className={`sus${crossed ? " crossed" : ""}${culprit ? " culprit" : ""}`}
        aria-pressed={crossed} onClick={onToggle}
        aria-label={`${s.name}: ${s.height} см, ніг ${s.legs}, улюблене число ${s.num}, шарф ${s.scarf}, опівночі ${s.place}${crossed ? ", закреслено" : ""}`}>
        <span className="em" aria-hidden>{s.emoji}</span>
        <b>{s.name}</b>
        <span className="attrs" aria-hidden>
          <span>📏 {s.height} см</span>
          <span>🦶 {s.legs}</span>
          <span>🔢 {s.num}</span>
          <span>🧣 {s.scarf}</span>
          <span>🌙 {s.place}</span>
        </span>
      </button>
    </li>
  );
}
