// The mathboard icon set (24×24, stroked with currentColor), ported as-is from Board.jsx.
import type { ReactNode } from "react";

const ICONS = {
  select: <path d="M5 3l13 7-5.5 1.8L10 17.5z" />,
  hand: (
    <path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-1V4.5a1.5 1.5 0 0 1 3 0V12m0-5a1.5 1.5 0 0 1 3 0v6.5a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L4 14.5a1.6 1.6 0 0 1 2.6-1.8L8 14" />
  ),
  pen: <path d="M4 20h4L18.6 9.4a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4" />,
  highlighter: <path d="M5 19l3.2-1L19 7.2 16.8 5 6 15.8zM14 7l3 3M3 21.5h8" />,
  eraser: <path d="M19 20H8.5l-4-4a2 2 0 0 1 0-2.8L13.2 4.5a2 2 0 0 1 2.8 0l3.5 3.5a2 2 0 0 1 0 2.8L11 19.5M9 11l6 6" />,
  shapes: (
    <>
      <rect x="3" y="11" width="9" height="9" rx="1.5" />
      <circle cx="15.5" cy="8.5" r="5" />
    </>
  ),
  text: <path d="M5 7V4.5h14V7M12 4.5v15M9 19.5h6" />,
  formula: <path d="M18 5H6.5l6 7-6 7H18" />,
  graph: <path d="M4 4v16h16M7 16c3-10 6 4 11-8" />,
  solid: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5" />,
  undo: <path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4.5h6V7" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  front: (
    <>
      <rect x="3" y="3" width="11" height="11" rx="1.5" />
      <rect x="10" y="10" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity=".25" />
    </>
  ),
  back: (
    <>
      <rect x="10" y="10" width="11" height="11" rx="1.5" />
      <rect x="3" y="3" width="11" height="11" rx="1.5" fill="currentColor" fillOpacity=".25" />
    </>
  ),
  grid: <path d="M4 4h16v16H4zM4 12h16M12 4v16M8 4v16M16 4v16M4 8h16M4 16h16" />,
  magnet: <path d="M6 4v8a6 6 0 0 0 12 0V4h-4v8a2 2 0 0 1-4 0V4zM6 8h4M14 8h4" />,
  pin: <path d="M12 21v-7M8 4h8l-1 6 3 3H6l3-3z" />,
  line: <path d="M5 19L19 5" />,
  arrow: <path d="M5 19L19 5M10 5h9v9" />,
  ellipse: <ellipse cx="12" cy="12" rx="9" ry="6.5" />,
  rect: <rect x="3.5" y="5.5" width="17" height="13" rx="1" />,
  triangle: <path d="M12 4l7 16H5z" />,
  tri_scalene: <path d="M3 19L9 5l12 11z" />,
  tri_eq: <path d="M12 4.5l9 15.5H3z" />,
  tri_obt: <path d="M3 18L7 8l14 10z" />,
  rtriangle: <path d="M5 4v16h14z" />,
  trapezoid: <path d="M8 5h8l5 14H3z" />,
  parallelogram: <path d="M8 5h13l-5 14H3z" />,
  pentagon: <path d="M12 3l9 6.8-3.5 10.7h-11L3 9.8z" />,
  hexagon: <path d="M7 4.5h10l5 7.5-5 7.5H7L2 12z" />,
  angle: <path d="M4 19h16M4 19L16 6M10 19a6 6 0 0 0-2.4-4.8" />,
  polygon: <path d="M4 18l3-12 9-2.5 4 9-6 6z" />,
  q_square: <rect x="5" y="5" width="14" height="14" />,
  q_rect: <rect x="3" y="7" width="18" height="10" />,
  q_rhombus: <path d="M12 3l8 9-8 9-8-9z" />,
  q_para: <path d="M7 6h14l-4 12H3z" />,
  q_trap_iso: <path d="M8 6h8l5 12H3z" />,
  q_trap_right: <path d="M4 6h10l6 12H4z" />,
  q_trap: <path d="M5 6h7l8 12H3z" />,
  q_quad: <path d="M4 16L7 5l13 3-3 11z" />,
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  laser: (
    <>
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
  ruler: <path d="M3 15L15 3l6 6L9 21zM7 11l2 2M10 8l1.6 1.6M13 5l2 2M5 13.5l1.5 1.5" />,
  template: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </>
  ),
  download: <path d="M12 4v11M7 10l5 5 5-5M4 20h16" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 7.6-1.7" />
    </>
  ),
  group: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
      <path d="M13 7h4v4M11 17H7v-4" strokeDasharray="2 2" />
    </>
  ),
  ungroup: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  comment: <path d="M4 5h16v11H10l-5 4v-4H4z" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </>
  ),
  poll: <path d="M5 20V11M12 20V4M19 20v-6" />,
  task: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  stamp: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  lesson: <path d="M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.5" />,
  parallel: <path d="M5 8h14M5 16h14M17 4l2 4-2 4M17 12l2 4-2 4" />,
  perpicon: <path d="M12 3v14M3 17h18M12 12h5v5" />,
  trig: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l5.7-5.7M4 12h16M12 4v16" />
    </>
  ),
  g_plane: <path d="M12 3v18M3 12h18M12 3l-2 3M12 3l2 3M21 12l-3-2M21 12l-3 2" />,
  g_line: <path d="M4 19L20 6M4 4v16h16" />,
  g_parab: <path d="M4 4v16h16M7 5c1 14 9 14 10 0" />,
  g_hyper: <path d="M4 4v16h16M7 8c1 7 3 9 12 10M10 5c8 1 9 4 9 8" />,
  g_sin: <path d="M3 12h18M3 12c2-8 4-8 6 0s4 8 6 0 4-8 6 0" />,
  g_exp: <path d="M4 4v16h16M5 18c8 0 11-3 14-13" />,
  g_circle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v20M2 12h20" strokeOpacity=".4" />
    </>
  ),
  g_system: <path d="M4 18L20 6M4 7l16 11" />,
  g_ineq: (
    <>
      <path d="M4 18L20 6" />
      <path d="M4 18L20 6v12H4z" fill="currentColor" fillOpacity=".18" stroke="none" />
    </>
  ),
  s_cube: <path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8" />,
  s_cuboid: <path d="M3 9l5-3h13v9l-5 3H3zM3 9h13l5-3M16 9v9" />,
  s_prism: <path d="M5 18l7 3 7-3V8L12 5 5 8zM5 8l7 3 7-3M12 11v10" />,
  s_pyramid: <path d="M12 3L3 17l9 4 9-4zM12 3v18M3 17l18 0" />,
  s_cylinder: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    </>
  ),
  s_cone: (
    <>
      <path d="M12 3L5 17c0 1.7 3.1 3 7 3s7-1.3 7-3z" />
      <path d="M5 17c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  s_sphere: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="9" ry="3.2" strokeOpacity=".5" />
    </>
  ),
  protractor: <path d="M3 18a9 9 0 0 1 18 0zM12 18V9M6.5 14l1.5-1.2M17.5 14L16 12.8" />,
  compass: <path d="M12 3v5M12 8l-6 13M12 8l6 13M8.5 15h7" />,
  arith: <path d="M7 5v6M4 8h6M14 8h6M4 16h6M14 14l6 4M20 14l-6 4M4 21h16" />,
  chart_bar: <path d="M4 20V4M4 20h16M8 20v-6M12 20V8M16 20v-9" />,
  chart_pie: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12V4M12 12l6.5 4.5" />
    </>
  ),
  chart_hist: <path d="M4 20h16M6 20v-5h3v5M9 20V9h3v11M12 20V5h3v15M15 20v-8h3v8" />,
  ptree: <path d="M3 12h5M8 12l6-6h6M8 12l6 6h6M14 6l3-2M14 6l3 2M14 18l3-2M14 18l3 2" />,
  die: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" fill="currentColor" />
      <circle cx="15" cy="15" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </>
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9h4M10 9v6" />
    </>
  ),
  cplane: <path d="M12 3v18M3 12h18M7 17l5-8 5 3" />,
  eqs1: <path d="M4 18L20 6M12 8l-3 4" />,
  eqs2: <path d="M4 18L20 6M10.5 8l-3 4M13.5 8l-3 4" />,
  eqs3: <path d="M4 18L20 6M9 8l-3 4M12 8l-3 4M15 8l-3 4" />,
  par1: <path d="M4 18L20 6M11 9l3 2.5-3 2.5" />,
  par2: <path d="M4 18L20 6M8 9l3 2.5L8 14M13 9l3 2.5-3 2.5" />,
  eqa1: <path d="M4 19h16M4 19L17 6M10 19a6 6 0 0 0-2.4-4.8" />,
  eqa2: <path d="M4 19h16M4 19L17 6M10 19a6 6 0 0 0-2.4-4.8M13 19a9 9 0 0 0-3.6-7.2" />,
  rang: <path d="M5 19h14M5 19V5M5 14h5v5" />,
  exgen: <path d="M5 5h14v14H5zM9 9h6M9 12h6M9 15h3" />,
  dot: <circle cx="12" cy="12" r="4" fill="currentColor" />,
  odot: <circle cx="12" cy="12" r="4" />,
  arrow2: <path d="M4 12h16M4 12l4-3M4 12l4 3M20 12l-4-3M20 12l-4 3" />,
  brace: <path d="M4 7c4 0 4 1 4 3.5S10 12 12 12M12 12c2 0 4 .5 4 1.5s0 3.5 4 3.5" transform="rotate(-90 12 12)" />,
  curvearr: <path d="M4 17c2-9 12-9 15-2M19 15l-4.2-.4M19 15l.8-4.2" />,
  cornerarr: <path d="M6 4v13h12M18 17l-3.5-3M18 17l-3.5 3" />,
  bracket: <path d="M4 17c0-9 16-9 16 0" />,
  midpt: (
    <>
      <path d="M4 18L20 6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </>
  ),
  bisect: <path d="M5 19L19 19M5 19L17 7M5 19L19 13M8.5 19a3.5 3.5 0 0 0-1 -2.5" />,
  circ3: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="6.5" cy="17" r="1" fill="currentColor" />
      <circle cx="19" cy="9" r="1" fill="currentColor" />
      <circle cx="11" cy="3.6" r="1" fill="currentColor" />
    </>
  ),
  circum: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 4.5L5 17h14z" />
    </>
  ),
  incirc: (
    <>
      <path d="M12 3.5L3 19h18z" />
      <circle cx="12" cy="14" r="3.6" />
    </>
  ),
  vcopy: <path d="M4 18l7-7M11 11l-3.6.4M11 11l-.4 3.6M13 20l7-7M20 13l-3.6.4M20 13l-.4 3.6" />,
  vsum_t: <path d="M4 18l7-9M11 9l7 3M4 18l14-6M18 12l-3.6-.2M18 12l-1.4 3.2" />,
  vsum_p: <path d="M4 18l6-9h9l-6 9zM4 18l15-9" />,
  vdiff: <path d="M4 18l8-11M4 18l12-2M12 7l4 9" />,
  vscale: <path d="M4 18l8-8M12 10l-3.4.2M12 10l-.2 3.4M14 8l6-6" />,
  numline: <path d="M3 12h18M6 9v6M12 9v6M18 9v6M21 12l-3-2M21 12l-3 2" />,
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </>
  ),
  venn: (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),
  png: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  pdf: <path d="M6 3h8l5 5v13H6zM14 3v5h5M9 14h6M9 17h4" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export const isIconName = (s: string): s is IconName => s in ICONS;

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {isIconName(name) ? ICONS[name] : null}
    </svg>
  );
}
