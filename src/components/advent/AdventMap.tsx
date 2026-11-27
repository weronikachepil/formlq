"use client";

import { useEffect, useRef, useState } from "react";
import { HEROES, heroDays, type Hero } from "@/lib/advent-map";

/**
 * «Мапа пригод»: a snowy road through twelve stops, one Ukrainian mathematician each.
 * A stop opens when both of its days are solved; the duckling stands at the furthest open
 * stop. Desktop draws the road; small screens get the same stops as a vertical route.
 */
export function AdventMap({ isSolved }: { isSolved: (day: number) => boolean }) {
  const [open, setOpen] = useState<Hero | null>(null);
  const unlocked = HEROES.map((h) => heroDays(h).every(isSolved));
  const met = unlocked.filter(Boolean).length;
  const duckAt = unlocked.lastIndexOf(true); // −1: still at the start

  // The road: a smooth curve through the stops (the map's own 0–100 coordinates).
  const pts = [{ x: 1, y: 88 }, ...HEROES.map((h) => ({ x: h.x, y: h.y }))];
  const curve = (upto: number) => {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i <= upto; i++) {
      const a = pts[i - 1], b = pts[i], mx = (a.x + b.x) / 2;
      d += ` C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
    }
    return d;
  };
  const d = curve(pts.length - 1);
  const done = curve(duckAt + 1); // up to the duckling's stop

  return (
    <div className="adv-map-wrap">
      <div className="adv-grid-head">
        <h2 id="map-title" className="adv-h2">Мапа пригод</h2>
        <p className="adv-sub">Каченя мандрує крізь час і зустрічає українських математиків · зустрінуто {met} з {HEROES.length}</p>
      </div>
      <p className="adv-map-lead">
        Кожні два розв&apos;язані віконця відкривають нову зупинку: історію героя, цікавий факт і те, як його відкриття живуть сьогодні.
      </p>

      {/* Desktop: the road */}
      <div className="adv-map" aria-hidden={false}>
        <svg className="adv-map-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path className="road-shadow" d={d} />
          <path className="road" d={d} />
          {duckAt >= 0 && <path className="road-done" d={done} />}
        </svg>
        {DECOR.map(([kind, x, y], i) => (
          <span key={i} className={`adv-map-deco ${kind}`} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden>
            {kind === "house" ? <House /> : <Pine />}
          </span>
        ))}
        <span className="adv-map-start" style={{ left: "1%", top: "88%" }}>Старт</span>
        {HEROES.map((h, i) => (
          <Stop key={h.n} h={h} unlocked={unlocked[i]} duck={i === duckAt} onOpen={() => setOpen(h)} />
        ))}
        {duckAt < 0 && <span className="adv-map-duck at-start" style={{ left: "1%", top: "88%" }} aria-hidden><Duck /></span>}
      </div>

      {/* Small screens: the same route, top to bottom */}
      <ol className="adv-route">
        {HEROES.map((h, i) => {
          const [a, b] = heroDays(h);
          return (
            <li key={h.n} className={unlocked[i] ? "open" : ""}>
              <button type="button" disabled={!unlocked[i]} onClick={() => setOpen(h)}>
                <span className="dot">{unlocked[i] ? h.n : <Lock />}</span>
                <span className="txt">
                  <b>{unlocked[i] ? h.name : `Зупинка ${h.n}`}</b>
                  <small>{unlocked[i] ? `${h.years} · ${h.place}` : `відкриється після днів ${a}–${b}`}</small>
                </span>
                {i === duckAt && <span className="route-duck" aria-label="Каченя тут"><Duck /></span>}
              </button>
            </li>
          );
        })}
      </ol>

      {open && <HeroDialog h={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Stop({ h, unlocked, duck, onOpen }: { h: Hero; unlocked: boolean; duck: boolean; onOpen: () => void }) {
  const [a, b] = heroDays(h);
  const below = h.y < 50;
  return (
    <div className={`adv-stop${unlocked ? " open" : ""}${below ? " below" : ""}`} style={{ left: `${h.x}%`, top: `${h.y}%` }}>
      <button
        type="button"
        className="pin"
        disabled={!unlocked}
        onClick={onOpen}
        aria-label={unlocked ? `${h.name}, ${h.years}` : `Зупинка ${h.n}, відкриється після днів ${a}–${b}`}
      >
        {unlocked ? h.n : <Lock />}
      </button>
      <span className="label">
        <b>{unlocked ? h.name.split(" ").slice(-1)[0] : `Зупинка ${h.n}`}</b>
        <small>{unlocked ? h.years : `дні ${a}–${b}`}</small>
      </span>
      {duck && <span className="adv-map-duck" aria-hidden><Duck /></span>}
    </div>
  );
}

function HeroDialog({ h, onClose }: { h: Hero; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = ref.current;
    if (dlg && !dlg.open) dlg.showModal();
  }, []);
  const [a, b] = heroDays(h);
  return (
    <dialog ref={ref} className="adv-dialog adv-hero-dlg" aria-labelledby="adv-hero-title"
      onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg-body">
        <header>
          <p className="dlg-meta">Зупинка {h.n} з {HEROES.length} · дні {a}–{b}</p>
          <h2 id="adv-hero-title">{h.name}</h2>
          <p className="adv-hero-sub">{h.years} · {h.place}</p>
          <button type="button" className="dlg-close" onClick={onClose} aria-label="Закрити">
            <svg viewBox="0 0 24 24" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>
        <p className="adv-hero-story">{h.story}</p>
        <div className="adv-hero-fact">
          <p className="k">Цікавий факт</p>
          <p>{h.fact}</p>
        </div>
        <div className="adv-hero-fact today">
          <p className="k">А сьогодні</p>
          <p>{h.today}</p>
        </div>
      </div>
    </dialog>
  );
}

/** Scenery between the stops: [kind, x %, y %], placed clear of pins and labels. */
const DECOR: ["pine" | "house", number, number][] = [
  ["pine", 4, 16], ["pine", 7, 24], ["house", 24, 10], ["pine", 33, 90], ["pine", 36, 84],
  ["house", 52, 12], ["pine", 57, 16], ["pine", 66, 84], ["house", 80, 8], ["pine", 85, 90], ["pine", 88, 94],
];

function Pine() {
  return (
    <svg viewBox="-24 -50 48 68">
      <path d="M0 -46 L16 -16 H8 L22 8 H-22 L-8 -16 H-16z" fill="#2f5d63" />
      <path d="M0 -46 L7 -33 Q0 -30 -7 -33z M-12 -18 Q0 -14 12 -18 L8 -16 H-8z" fill="#fff" />
      <rect x="-3" y="8" width="6" height="8" fill="#8a6a55" />
    </svg>
  );
}

function House() {
  return (
    <svg viewBox="0 0 48 44">
      <path d="M6 20 L24 6 L42 20 V42 H6z" fill="#e6c9b5" />
      <path d="M2 22 L24 4 L46 22" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 22 L24 4 L46 22" fill="none" stroke="#b5654a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20" y="28" width="9" height="14" rx="1.5" fill="#8a5a3c" />
      <rect x="10" y="24" width="7" height="7" rx="1" fill="#f4c430" />
      <rect x="32" y="24" width="7" height="7" rx="1" fill="#f4c430" />
    </svg>
  );
}

function Lock() {
  return (
    <svg className="lock" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** The duckling in a winter hat (same drawing as the hero hills). */
function Duck() {
  return (
    <svg viewBox="-22 -32 54 54">
      <path d="M-18 4c0-8 10-10 18-6 5 2 8 0 11-2l3 3c0 11-10 19-21 17-7-1-11-6-11-12z" fill="#f4c430" />
      <circle cx="12" cy="-9" r="9" fill="#f4c430" />
      <path d="M20 -11l9 3.5-9 3.5z" fill="#ef8a2b" />
      <circle cx="14" cy="-11" r="1.5" fill="#14262a" />
      <path d="M2 -14 Q 12 -30 22 -14z" fill="#ff8d6b" />
      <circle cx="13" cy="-27" r="3.6" fill="#fff" />
      <path d="M2 -14 H22" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M4 -1 Q 13 3 20 -2 L 22 8 L17 7 L 16 1 Q 10 3 4 1z" fill="#cfc6f7" />
    </svg>
  );
}
