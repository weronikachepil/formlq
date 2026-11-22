import type { SourceKind } from "./constants";

/** Drop-down menus of the toolbar and the top-right bar (one open at a time). */
export type MenuId = "insert" | "shapes" | "instr" | "lesson" | "export" | "peers";

/** Board dialogs opened from the UI (engine-driven dialogs come from the state instead). */
export type DialogRequest =
  | { kind: "assign" }
  | { kind: "testImport" }
  | { kind: "testLibrary" }
  | { kind: "numline" }
  | { kind: "source"; src: SourceKind }
  | { kind: "exercises" }
  | { kind: "results" };

export interface MenuControl {
  menu: MenuId | null;
  toggle: (id: MenuId) => void;
  close: () => void;
  /** Close the menu and switch the board tool. */
  setTool: (tool: string) => void;
  openDialog: (d: DialogRequest) => void;
}
