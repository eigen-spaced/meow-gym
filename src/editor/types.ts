// Core data model for the meow editor simulation.

export type Mode = "normal" | "insert";

export interface Pos {
  row: number;
  col: number;
}

/** A half-open [start, end) span to highlight as a goal target in the buffer. */
export interface TargetSpan {
  start: Pos;
  end: Pos;
  /** Optional CSS class for color-coding the job (t-del / t-fix / t-yank …). */
  cls?: string;
}

/**
 * meow is selection-first: nearly every command acts on the current selection.
 * We model a selection as two ends — `anchor` (fixed) and `active` (the moving
 * end where the cursor sits). When `kind` is null there is no live selection and
 * the cursor is simply a point at `active`.
 *
 * `kind` records *what* was selected so meow's expansions behave correctly:
 *  - "char": grown character-by-character (H/J/K/L)
 *  - "word"/"symbol": created by word/symbol motions, expandable by the same
 *  - "line": whole lines, expandable line-by-line and deleted as whole lines
 */
export type SelectionKind = "char" | "word" | "symbol" | "line" | null;

export interface EditorState {
  lines: string[];
  anchor: Pos;
  active: Pos;
  kind: SelectionKind;
  mode: Mode;
  /** meow's kill-ring; what `p` (yank/paste) pastes. */
  killRing: string;
  /** True when the kill-ring holds whole line(s), so paste lands on its own line. */
  killIsLine: boolean;
  /** Goal column remembered across vertical moves, vim/meow style. */
  goalCol: number;
}

/** Result of feeding a key to the engine. */
export interface KeyResult {
  /** True if the key produced a meaningful editor action. */
  handled: boolean;
  /**
   * A "you're thinking in vim" nudge, if the key is a known muscle-memory trap.
   * Shown to the user without blocking the (correct) meow action.
   */
  vimHint?: VimHint;
  /** A transient echo-area prompt, e.g. while waiting for a find target. */
  echo?: string;
}

export interface VimHint {
  key: string;
  /** What this key does in vim. */
  vim: string;
  /** What it just did in meow. */
  meow: string;
  /** Optional concrete "do this instead" tip. */
  tip?: string;
}
