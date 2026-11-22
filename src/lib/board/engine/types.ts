// Typed object model of the MathBoard engine.
// Every board object is an immutable plain JSON value: a change produces a new object with the same id.
// Objects travel over the wire as-is, so everything here must stay JSON-serialisable.

// ====================== geometry ======================

/** A point in board coordinates (or unit coordinates inside a cplane). */
export type Point = [number, number];

/** Axis-aligned rectangle; the shape returned by geom.js (boundsOfPoints, unionBounds, rectFromPoints). */
export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A point in 3D model space (solid.js). */
export type Vec3 = [number, number, number];

// ====================== object types ======================

/** Every object type the server accepts (server/index.mjs OBJECT_TYPES) and shapes.js `T` registers. */
export const OBJECT_TYPES = [
  "stroke",
  "line",
  "ellipse",
  "polygon",
  "angle",
  "text",
  "formula",
  "graph",
  "solid",
  "image",
  "page",
  "arc",
  "ruler",
  "protractor",
  "comment",
  "poll",
  "vote",
  "timer",
  "trig",
  "numline",
  "colmath",
  "fmodel",
  "chart",
  "dice",
  "ptree",
  "cplane",
  "flag",
  "task",
  "stamp",
  "quiz",
  "answer",
  "score",
] as const;

export type ObjectType = (typeof OBJECT_TYPES)[number];

/** A user id, or the literal "owner" for objects created by the board owner (teacher). */
export type AuthorId = "owner" | (string & Record<never, never>);

// ====================== base ======================

/**
 * Fields shared by all objects.
 *
 * The style fields (`c`, `s`, `f`, `dash`) are optional here because `MathBoard.setStyle` patches
 * them onto any selected object regardless of type, and generic code (render culling, selection
 * padding) reads `o.s` from any object. Types that always carry them narrow them to required.
 */
export interface BaseObject {
  id: string;
  type: ObjectType;
  /** Stacking order; the store sorts ascending. Service objects (vote, answer, flag, score) use 0. */
  z: number;
  /** Page id the object lives on. Missing means the default page "p1". Not set on `page` objects. */
  pg?: string;
  /** Author: user id, or "owner" for the teacher. Set by `addObj` and enforced by the server. */
  by?: AuthorId;
  /** Locked by the teacher: nobody (students included) can move, resize or delete it. */
  lock?: boolean;
  /** Group id ("g_…"): objects sharing it are selected and moved together. */
  grp?: string;
  /** Stroke / text colour (CSS colour). */
  c?: string;
  /** Stroke width in board pixels. */
  s?: number;
  /** Fill colour; null means no fill. */
  f?: string | null;
  /** Dashed outline. */
  dash?: boolean;
}

/** Objects with an axis-aligned frame. */
export interface BoxFields {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Frame objects that `withRotation` (extra.js) can rotate about their centre. */
export interface Rotatable extends BoxFields {
  /** Rotation in radians, normalised to (-π, π]. Missing or 0 means unrotated. */
  rot?: number;
}

// ====================== drawing primitives ======================

export interface StrokeObject extends BaseObject {
  type: "stroke";
  /** Polyline, drawn smoothed with quadratic curves. Always at least 2 points. */
  pts: Point[];
  c: string;
  s: number;
  /** Highlighter stroke (translucent, multiply blend). */
  hl?: boolean;
  /** Stylus pressure per point, 0…1 (pen with pressure): the line is wider where pressed harder. */
  w?: number[];
}

export interface LineObject extends BaseObject {
  type: "line";
  pts: [Point, Point];
  c: string;
  s: number;
  /** Arrow head at the end point. */
  arrow?: boolean;
  /** Arrow head at the start point too (double arrow). */
  arrow2?: boolean;
  /** Show the length label. */
  lens?: boolean;
  /** Custom length label text; overrides the computed length. */
  lent?: string;
}

export interface EllipseObject extends BaseObject, Rotatable {
  type: "ellipse";
  c: string;
  s: number;
  /** Solid (opaque) fill instead of the translucent one; used for construction points. */
  solid?: boolean;
}

/** Triangle constructions (triangle.js CONS_KINDS). */
export type TriangleConsKind = "alt" | "med" | "bis" | "mid" | "perp";
/** Quadrilateral constructions (triangle.js QUAD_COLORS). */
export type QuadConsKind = "diag" | "qalt" | "qmid" | "qbis";

export interface TriangleConstruction {
  k: TriangleConsKind;
  /** Vertex (alt/med/bis/mid) or side (perp) index, 0–2. */
  i: number;
  /** Label; for "mid" a two-letter string, one letter per end point. */
  lab?: string;
}

/** Centre point of three constructions of the same kind (orthocentre, centroid, …). */
export interface TriangleCentre {
  k: "ctr";
  of: Exclude<TriangleConsKind, "mid">;
  lab?: string;
}

export interface QuadConstruction {
  k: QuadConsKind;
  /** Vertex / side index, 0–3. */
  i: number;
  /** Variant: for "qalt", 1 means the altitude onto the adjacent side. */
  j?: number;
  lab?: string;
}

export type PolygonConstruction = TriangleConstruction | TriangleCentre | QuadConstruction;

/** Inscribed / circumscribed circle settings (triangles and quadrilaterals). */
export interface PolygonCircle {
  /** Centre label. */
  lab?: string;
  /** Show the radius; only `false` hides it. */
  rad?: boolean;
}

export interface PolygonObject extends BaseObject {
  type: "polygon";
  /** Vertices, closed implicitly. */
  pts: Point[];
  c: string;
  s: number;
  /** Vertex labels, one character per vertex ("ABC"); "" means none. */
  labs?: string;
  /** Right-angle and equal-side tick marks. */
  marks?: boolean;
  /** Constructions; only drawn for 3 or 4 vertices. */
  cons?: PolygonConstruction[];
  circs?: { in?: PolygonCircle; out?: PolygonCircle };
  /** Show side lengths. */
  lens?: boolean;
  /** Show interior angles. */
  angs?: boolean;
  /** Show the area. */
  area?: boolean;
  /** Custom side labels by side index (null = automatic). */
  sidet?: (string | null)[];
  /** Custom angle labels by vertex index (null = automatic). */
  angt?: (string | null)[];
}

export interface AngleObject extends BaseObject {
  type: "angle";
  /** A, B (vertex), C. */
  pts: [Point, Point, Point];
  c: string;
  s: number;
  /** Vertex labels ("ABC"). */
  labs?: string;
  /** Angle value label; only `false` hides it. */
  angs?: boolean;
  /** Custom angle text (e.g. "α"); empty or missing means degrees. */
  angt?: string;
}

/** Keys of shapes.js TEXT_FONTS. */
export type TextFontId = "comfortaa" | "sans" | "serif" | "georgia" | "mono" | "hand";

export interface TextObject extends BaseObject, Rotatable {
  type: "text";
  text: string;
  /** Font size in board pixels. */
  fs: number;
  c: string;
  ff?: TextFontId;
  /** Bold. */
  b?: boolean;
  /** Italic. */
  i?: boolean;
}

/** LaTeX formula rendered by MathLive in the DOM layer. */
export interface FormulaObject extends BaseObject, Rotatable {
  type: "formula";
  latex: string;
  fs: number;
  c: string;
}

export interface ImageObject extends BaseObject, Rotatable {
  type: "image";
  /** Data URL. */
  src: string;
  /** Source PDF file name when the image is a rendered PDF page. */
  pdf?: string;
  /** 1-based page number within that PDF (not `pg`, which is the board page). */
  pdfPage?: number;
  /**
   * Visible part of the source image as fractions [x, y, w, h] of its full size; the
   * object's box shows only that part. Missing means the whole image. The hidden part
   * stays in `src`, so the frame can later be widened to reveal more (e.g. a task step by step).
   */
  crop?: [number, number, number, number];
}

export interface ArcObject extends BaseObject {
  type: "arc";
  cx: number;
  cy: number;
  r: number;
  /** Start / end angle in radians; a1 < a0 means counter-clockwise. */
  a0: number;
  a1: number;
  c: string;
  s: number;
}

export interface RulerObject extends BaseObject, Rotatable {
  type: "ruler";
}

export interface ProtractorObject extends BaseObject, Rotatable {
  type: "protractor";
}

// ====================== maths objects ======================

/** Graph viewport: unit coordinates of the frame centre and pixels per unit. */
export interface GraphView {
  cx: number;
  cy: number;
  sx: number;
  sy: number;
}

export interface GraphObject extends BaseObject, BoxFields {
  type: "graph";
  v: GraphView;
  /** Expressions, one per line ("y=2x-1", "x^2+y^2=r^2", "(2, 3)", "y>x^2"). */
  exprs: string;
  /** Slider values for free parameters. */
  params: Record<string, number>;
  /** Slider ranges [min, max] for free parameters. */
  ranges: Record<string, [number, number]>;
  legend: boolean;
  zeros?: boolean;
  /** Mark extrema. */
  ext?: boolean;
  /** Mark intersections. */
  inter?: boolean;
  deriv?: boolean;
  /** Antiderivative. */
  anti?: boolean;
  /** Shaded integral interval [a, b] in units; null = off. */
  area?: [number, number] | null;
  /** Tangent at x (units); null = off. */
  tan?: number | null;
}

/** One slider as computed by graph.js graphParams. */
export interface GraphParamInfo {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

export type SolidKind = "cube" | "cuboid" | "prism" | "pyramid" | "cylinder" | "cone" | "sphere";

/** Point on a solid edge: edge index and position 0–1 along it. */
export interface SolidEdgeRef {
  e: number;
  t: number;
}

/** Cross-section of a solid by a plane. */
export type SolidSection =
  | { mode: "pts"; pts: SolidEdgeRef[] }
  | { mode: "horiz"; t?: number }
  | { mode: "axial"; a?: number }
  | { mode: "tilt"; a?: number; tilt?: number; off?: number };

/** Extra segments drawn on a solid. */
export interface SolidMarks {
  /** Height. */
  h?: boolean;
  /** Apothem (pyramid). */
  ap?: boolean;
  /** Slant height (cone). */
  l?: boolean;
  /** Radius. */
  r?: boolean;
  /** Space diagonal (cube / cuboid). */
  diag?: boolean;
  /** Base diagonal (cube / cuboid). */
  bdiag?: boolean;
}

export interface SolidObject extends BaseObject, BoxFields {
  type: "solid";
  kind: SolidKind;
  yaw: number;
  pitch: number;
  /** "School" oblique (cavalier) projection instead of free rotation. */
  school: boolean;
  /** Draw hidden edges dashed (unrelated to ObjectTypeDef.hidden). */
  hidden: boolean;
  /** Show vertex / centre labels. */
  labs: boolean;
  c: string;
  s: number;
  f: string | null;
  /** Section colour. */
  sc: string;
  /** Marks colour. */
  mc: string;
  marks: SolidMarks;
  sec: SolidSection | null;
  /** Number of base sides (prism, pyramid), 3–12. */
  n?: number;
  /** Height ratio (prism, pyramid, cylinder, cone). */
  hr?: number;
  /** Custom vertex names by vertex index. */
  names?: string[];
  /** Custom labels for named points/segments ("O", "O1", "S", "h", "l", "M", "r", "R", "d", "bd", "sec0"…). */
  tags?: Record<string, string>;
}

export interface TrigObject extends BaseObject, BoxFields {
  type: "trig";
  /** Angle in radians, 0…2π. */
  ang: number;
  /** Snap to multiples of 15°. */
  snap: boolean;
  showCot: boolean;
  showRad: boolean;
}

/** Interval on a number line; null bound means infinity. */
export interface NumlineInterval {
  a: number | null;
  b: number | null;
  /** Bound included (filled dot); only `false` means excluded. */
  ai: boolean;
  bi: boolean;
  c: string;
}

export interface NumlineObject extends BaseObject, BoxFields {
  type: "numline";
  c: string;
  ivs: NumlineInterval[];
}

export type ArithSign = "+" | "−" | "×" | "÷";
/** Column arithmetic operation; "frac" = fraction operation. */
export type ColmathOp = ArithSign | "frac";

export interface ColmathObject extends BaseObject {
  type: "colmath";
  op: ColmathOp;
  /** Operator used when op is "frac". */
  fop: ArithSign;
  /** Operands as text ("348", or "1/2" for fractions). */
  a: string;
  b: string;
  /** Cell size in board pixels (size is derived from the grid, not stored). */
  cell: number;
  x: number;
  y: number;
  c: string;
}

export type FmodelKind = "circle" | "strip";

/** Fraction model: a shape split into n parts, some filled. */
export interface FmodelObject extends BaseObject, BoxFields {
  type: "fmodel";
  kind: FmodelKind;
  n: number;
  /** Filled part indices, sorted. */
  fill: number[];
  c: string;
}

export type ChartKind = "bar" | "pie" | "hist";

export interface ChartObject extends BaseObject, BoxFields {
  type: "chart";
  kind: ChartKind;
  /** Data text: "label value" per line (bar/pie) or raw numbers (hist). */
  src: string;
  /** Show the statistics line. */
  stats: boolean;
  /** Histogram: relative frequencies in %. */
  rel?: boolean;
  /** Histogram: frequency polygon. */
  poly?: boolean;
  /** Histogram: mean and median lines. */
  mlines?: boolean;
  /** Histogram: gaps between bars. */
  gap?: boolean;
  /** Histogram: hide value labels. */
  nov?: boolean;
  /** Histogram: multi-coloured bars. */
  rb?: boolean;
  /** Histogram: bin width; missing = automatic. */
  bw?: number;
}

export type DiceKind = "die" | "coin";

export interface DiceObject extends BaseObject, BoxFields {
  type: "dice";
  kind: DiceKind;
  /** Number of dice (1 or 2; 2 = sum). */
  cnt: number;
  /** Last roll: pip values, or 0/1 (heads/tails) for a coin. */
  cur: number[];
  /** Total number of rolls. */
  tot: number;
  /** Frequency per outcome label ("1"…"12", "Г", "Ц"). */
  freq: Record<string, number>;
  c: string;
}

/** Probability tree; size is derived from `src` and `k`. */
export interface PtreeObject extends BaseObject {
  type: "ptree";
  /** Levels separated by blank lines, "label probability" per line. */
  src: string;
  /** Scale factor. */
  k: number;
  x: number;
  y: number;
  c: string;
}

export interface CplaneObject extends BaseObject, BoxFields {
  type: "cplane";
  /** Axis range: −R…R units. */
  R: number;
  /** Points in unit coordinates (max 26). */
  pts: Point[];
  joined: boolean;
  closed: boolean;
  lens: boolean;
  /** Show point names with coordinates (a boolean here, unlike SolidObject.names). */
  names: boolean;
  c: string;
}

// ====================== pages ======================

/**
 * Page (sheet) service object. Never drawn; the default page "p1" may not exist as an object.
 * Only the owner may create or change pages.
 */
export interface PageObject extends BaseObject {
  type: "page";
  name?: string;
  /** Personal page of this student uid (an assignment or a per-student test copy). */
  for?: string;
  /** Private: other students cannot see a personal page. */
  priv?: boolean;
  /** Test page (holds quiz cards). */
  test?: boolean;
  /** Test not started yet: only the owner sees it. */
  draft?: boolean;
  /** Test finished: answers are closed. */
  closed?: boolean;
  /** Server-time ms when the test auto-closes; null = no limit. */
  endsAt?: number | null;
  /** Template for per-student copies ("every student gets a separate sheet"); only the owner sees it. */
  perStudent?: boolean;
  /** Template page id this personal copy was made from. */
  from?: string;
  /**
   * Paper mode (as a notebook page): a sheet of fixed width whose top-left corner is here; `n`
   * A4 sheets added with «+ Сторінка», and more grow on their own as content reaches the bottom.
   * null / absent — the endless board.
   */
  paper?: { x: number; y: number; n?: number } | null;
}

/** Page summary as returned by MathBoard.pages(). */
export interface PageSummary {
  id: string;
  name?: string;
  for?: string;
  priv?: boolean;
  test?: boolean;
  closed?: boolean;
  perStudent?: boolean;
  from?: string;
  /** Paper mode is on for this page. */
  paper?: boolean;
}

// ====================== classroom ======================

export type CommentVisibility = "all" | "teacher";

export interface CommentMessage {
  by: string;
  name?: string;
  text: string;
  /** Client time, ms. */
  t: number;
}

/** Comment pin; (x, y) is the pin tip. */
export interface CommentObject extends BaseObject {
  type: "comment";
  x: number;
  y: number;
  thread: CommentMessage[];
  /** "teacher" = private note visible to the owner only. */
  vis: CommentVisibility;
  resolved: boolean;
}

export interface PollObject extends BaseObject {
  type: "poll";
  x: number;
  y: number;
  /** Width; height is derived from the layout. */
  w: number;
  /** Question. */
  q: string;
  /** Options (max 6). */
  opts: string[];
  closed: boolean;
  /** Hide results from students until closed. */
  hide: boolean;
}

/** One student's vote (service object, never drawn). Id: `vote_${pollId}_${uid}`. */
export interface VoteObject extends BaseObject {
  type: "vote";
  poll: string;
  /** Option index. */
  opt: number;
  by: string;
  pg: string;
}

export interface TimerObject extends BaseObject, BoxFields {
  type: "timer";
  /** Duration, ms. */
  dur: number;
  /** Remaining ms while paused. */
  left: number;
  running: boolean;
  /** Server-time ms when a running timer ends; null when paused. */
  endsAt: number | null;
  title?: string;
}

/** Task card; height is derived from the text. */
export interface TaskObject extends BaseObject {
  type: "task";
  x: number;
  y: number;
  w: number;
  title: string;
  text: string;
  /** Points badge text ("" = none). NOT a point list, unlike other `pts` fields. */
  pts: string;
}

export type StampKind = "ok" | "bad" | "part" | "q";

/** Grade stamp; (x, y) is the centre. */
export interface StampObject extends BaseObject {
  type: "stamp";
  x: number;
  y: number;
  kind: StampKind;
  /** Caption next to the stamp. */
  text: string;
}

/** "Work submitted" mark (service object). Id: `flag_${pg}_${uid}`. */
export interface FlagObject extends BaseObject {
  type: "flag";
  kind: "done";
  by: string;
  pg: string;
  name?: string;
  /** Time, ms. */
  t: number;
  /** Set by the server when it auto-submits on test close. */
  auto?: boolean;
}

// ====================== tests ======================

export type QuizQuestionType = "choice" | "short" | "match";

export interface QuizOption {
  /** Cyrillic letter "А"…"Е". */
  l: string;
  t: string;
}

export interface QuizLeftItem {
  n: number;
  t: string;
}

/** Correct answer. Stripped by the server for students until the card is revealed. */
export interface QuizKey {
  /** choice: correct letter. */
  correct?: string;
  /** short: correct answer text (compared numerically when both parse as numbers). */
  answer?: string;
  /** match: left item number → right letter. */
  pairs?: Record<string, string>;
}

/** A student's answer: a letter (choice), text (short) or left number → letter map (match). */
export type QuizAnswerValue = string | Record<string, string>;

/** Question as produced by quizparse.js parseTest. */
export interface QuizQuestion {
  n: number;
  qt: QuizQuestionType;
  pts: number;
  text: string;
  /** Image file name (resolved to a data URL on import). */
  img: string;
  opts: QuizOption[];
  left: QuizLeftItem[];
  right: QuizOption[];
  key: QuizKey;
  expl: string;
  explImg: string;
}

/** Test question card (DOM). */
export interface QuizObject extends BaseObject, BoxFields {
  type: "quiz";
  /** Question number; cards are laid out in this order. */
  n: number;
  qt: QuizQuestionType;
  /** Max points. NOT a point list. */
  pts: number;
  text: string;
  /** Data URL or "". */
  img: string;
  opts: QuizOption[];
  left: QuizLeftItem[];
  right: QuizOption[];
  /** Missing for students until `reveal`. */
  key?: QuizKey;
  /** Explanation; missing for students until `reveal`. */
  expl?: string;
  explImg?: string;
  /** Teacher revealed the key and explanation to students. */
  reveal: boolean;
  /** false once the card was moved by hand (excluded from automatic column layout). */
  auto?: boolean;
}

/** A student's answer to one quiz card (service object). Id: `ans_${quizId}_${uid}`. */
export interface AnswerObject extends BaseObject {
  type: "answer";
  quiz: string;
  val: QuizAnswerValue;
  by: string;
  name?: string;
  pg: string;
}

/** Total score of a submitted test, computed by the server. Id: `score_${pg}_${uid}`. */
export interface ScoreObject extends BaseObject {
  type: "score";
  by: string;
  pg: string;
  name?: string;
  earned: number;
  max: number;
  t: number;
}

export type QuizGradeState = "full" | "part" | "none" | "empty";

export interface QuizGrade {
  earned: number;
  max: number;
  state: QuizGradeState;
}

// ====================== union ======================

export type BoardObject =
  | StrokeObject
  | LineObject
  | EllipseObject
  | PolygonObject
  | AngleObject
  | TextObject
  | FormulaObject
  | GraphObject
  | SolidObject
  | ImageObject
  | PageObject
  | ArcObject
  | RulerObject
  | ProtractorObject
  | CommentObject
  | PollObject
  | VoteObject
  | TimerObject
  | TrigObject
  | NumlineObject
  | ColmathObject
  | FmodelObject
  | ChartObject
  | DiceObject
  | PtreeObject
  | CplaneObject
  | FlagObject
  | TaskObject
  | StampObject
  | QuizObject
  | AnswerObject
  | ScoreObject;

export type ObjectOf<K extends ObjectType> = Extract<BoardObject, { type: K }>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An object before `addObj` / `addObjs` assigns id and z (pg and by are optional anyway). */
export type ObjectDraft<O extends BoardObject = BoardObject> = DistributiveOmit<O, "id" | "z"> & {
  id?: string;
  z?: number;
};

/** A factory template placed later: like ObjectDraft, but position fields may be missing too. */
export type ObjectTemplate<O extends BoardObject> = Omit<O, "id" | "z" | "x" | "y"> & Partial<O>;

/** A change: set the object, or delete it when null. */
export type Op = [id: string, obj: BoardObject | null];

// ====================== type registry ======================

/** Vote tally per poll, as built by MathBoard.voteInfo(). */
export interface PollVoteInfo {
  counts: number[];
  /** Option the current user voted for, or -1. */
  mine: number;
  total: number;
}

/**
 * Third argument of `draw`. The board passes all fields; tool previews and export pass only
 * `{ zoom }` (export also `repaint`), so everything but `zoom` is optional.
 */
export interface DrawEnv {
  zoom: number;
  /** Text object currently being edited in a textarea (not drawn). */
  hideId?: string | null;
  /** Object in interactive mode (graph, solid, trig, …). */
  interactingId?: string | null;
  /** Request a repaint (e.g. after an image loads). */
  repaint?: () => void;
  /** Server time, ms. */
  now?: number;
  polls?: Map<string, PollVoteInfo>;
  isOwner?: boolean;
}

/**
 * A registry entry (shapes.js `T`, and the *_TYPE constants). Members use method syntax so that
 * `ObjectTypeDef<StrokeObject>` stays assignable to `ObjectTypeDef<BoardObject>`.
 * All transforms are pure and return a new object.
 */
export interface ObjectTypeDef<O extends BoardObject = BoardObject> {
  bounds(o: O): Bounds;
  draw(ctx: CanvasRenderingContext2D, o: O, env: DrawEnv): void;
  /** `tol` is the hit tolerance in board pixels (some types ignore it). */
  hit(o: O, p: Point, tol: number): boolean;
  move(o: O, dx: number, dy: number): O;
  /** Map the object from frame `from` (its bounds) into frame `to`. */
  fit(o: O, from: Bounds, to: Bounds): O;
  /** Rotate by `angle` radians about (cx, cy). Present only for rotatable types. */
  rotate?(o: O, angle: number, cx: number, cy: number): O;
  /** Draggable vertices (line, polygon, angle). */
  verts?(o: O): Point[];
  /** Service type: never drawn, excluded from MathBoard.objs(). */
  hidden?: boolean;
  /** Rendered by the DOM layer (formula, graph sliders, quiz). */
  dom?: boolean;
  /** Has an interactive mode entered by double-click (graph, solid, trig, fmodel, cplane). */
  interactive?: boolean;
}

/** Shape of shapes.js `T`. */
export type TypeRegistry = { [K in ObjectType]: ObjectTypeDef<ObjectOf<K>> };

// ====================== board state ======================

export interface ViewRect extends Bounds {
  /** Page id. */
  pg: string;
}

export interface LaserPoint {
  x: number;
  y: number;
  /** performance.now() timestamp. */
  t: number;
}

/**
 * One laser stroke, as in note apps: it stays whole while the pen is down and fades out
 * as a whole once it is lifted.
 */
export interface LaserStroke {
  pts: LaserPoint[];
  /** performance.now() when the pen was lifted; null while it is still down. */
  end: number | null;
}

/** Remote participant, as stored in MathBoard.peers (keyed by connection id). */
export interface Peer {
  name: string;
  color: string;
  uid: string;
  /** The peer is the board owner (teacher). */
  owner: boolean;
  /** Last viewport the peer reported. */
  view?: ViewRect;
  /** Cursor position (board coordinates). */
  x: number;
  y: number;
  /** performance.now() of the last cursor update; 0 = never. */
  t: number;
  laser?: LaserStroke[];
}

export type GridMode = "squares" | "dots" | "none";

/** MathBoard.prefs (persisted in localStorage). */
export interface BoardPrefs {
  grid: GridMode;
  /** Snap to the grid. */
  snap: boolean;
  /** Keep the current tool after drawing a shape. */
  keep: boolean;
  /** Recognise hand-drawn shapes. */
  recognize: boolean;
  /** Only the stylus draws; a finger pans the board. Switched on by the first stylus touch. */
  stylusOnly: boolean;
  /** Eraser radius on screen, px. */
  eraser: number;
  /** The pen follows stylus pressure (wider when pressed harder). */
  pressure: boolean;
  /** The eraser removes only the part of a stroke it passes over (else whole strokes). */
  eraseParts: boolean;
}

/** MathBoard.style: current drawing style for new objects. */
export interface DrawStyle {
  c: string;
  s: number;
  f: string | null;
  dash: boolean;
  /** Font size for new text. */
  fs: number;
  /** Font size for new formulas. */
  mfs: number;
  ff: TextFontId;
  b: boolean;
  i: boolean;
  /** Highlighter colour. */
  hc: string;
  /** Highlighter width. */
  hs: number;
}

/** Camera: top-left corner in board coordinates and zoom. */
export interface Camera {
  x: number;
  y: number;
  z: number;
}
