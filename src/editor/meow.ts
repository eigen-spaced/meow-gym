import type { EditorState, KeyResult, Pos, SelectionKind } from "./types";
import { lookupVimHint } from "./vimKeys";

// ---------------------------------------------------------------------------
// Position / text helpers (treat the buffer as a stream of positions so word
// and symbol motions can cross line boundaries, like real meow).
// ---------------------------------------------------------------------------

const isWordChar = (ch: string | null): boolean =>
  ch !== null && /[A-Za-z0-9_]/.test(ch);
const isSymbolChar = (ch: string | null): boolean =>
  ch !== null && ch !== "\n" && !/\s/.test(ch);

function clone(p: Pos): Pos {
  return { row: p.row, col: p.col };
}

function cmp(a: Pos, b: Pos): number {
  return a.row !== b.row ? a.row - b.row : a.col - b.col;
}

function ordered(a: Pos, b: Pos): [Pos, Pos] {
  return cmp(a, b) <= 0 ? [a, b] : [b, a];
}

/** Character at a position, "\n" at a line end (if more lines follow), else null. */
function charAt(lines: string[], p: Pos): string | null {
  if (p.row < 0 || p.row >= lines.length) return null;
  const line = lines[p.row];
  if (p.col < line.length) return line[p.col];
  if (p.col === line.length) return p.row < lines.length - 1 ? "\n" : null;
  return null;
}

function nextPos(lines: string[], p: Pos): Pos | null {
  const line = lines[p.row];
  if (p.col < line.length) return { row: p.row, col: p.col + 1 };
  if (p.row < lines.length - 1) return { row: p.row + 1, col: 0 };
  return null;
}

function prevPos(lines: string[], p: Pos): Pos | null {
  if (p.col > 0) return { row: p.row, col: p.col - 1 };
  if (p.row > 0) return { row: p.row - 1, col: lines[p.row - 1].length };
  return null;
}

function clampToLine(lines: string[], p: Pos, allowEnd = true): Pos {
  const row = Math.max(0, Math.min(p.row, lines.length - 1));
  const max = lines[row].length - (allowEnd ? 0 : 1);
  const col = Math.max(0, Math.min(p.col, Math.max(0, max)));
  return { row, col };
}

interface Snapshot {
  lines: string[];
  anchor: Pos;
  active: Pos;
  kind: SelectionKind;
}

// ---------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------

type Pending = null | "find" | "till" | "inner" | "bounds";

export class MeowEngine {
  state: EditorState;
  private undoStack: Snapshot[] = [];
  /** When set, the next key is an argument (a char to find, or a THING). */
  private pending: Pending = null;

  constructor(lines: string[]) {
    this.state = MeowEngine.freshState(lines);
  }

  static freshState(lines: string[]): EditorState {
    return {
      lines: lines.length ? [...lines] : [""],
      anchor: { row: 0, col: 0 },
      active: { row: 0, col: 0 },
      kind: null,
      expandable: false,
      mode: "normal",
      killRing: "",
      killIsLine: false,
      goalCol: 0,
    };
  }

  reset(lines: string[]): void {
    this.state = MeowEngine.freshState(lines);
    this.undoStack = [];
    this.pending = null;
  }

  /** Highlighted selection range for rendering, or null when there's just a cursor. */
  selectionRange(): { start: Pos; end: Pos } | null {
    if (this.state.kind === null) return null;
    const [start, end] = ordered(this.state.anchor, this.state.active);
    return { start: clone(start), end: clone(end) };
  }

  private snapshot(): void {
    const s = this.state;
    this.undoStack.push({
      lines: [...s.lines],
      anchor: clone(s.anchor),
      active: clone(s.active),
      kind: s.kind,
    });
    if (this.undoStack.length > 200) this.undoStack.shift();
  }

  private collapse(to: Pos = this.state.active): void {
    this.state.anchor = clone(to);
    this.state.active = clone(to);
    this.state.kind = null;
    this.state.expandable = false;
  }

  // -------------------------------------------------------------------------
  // Key entry point
  // -------------------------------------------------------------------------

  feed(key: string, shift = false): KeyResult {
    if (this.state.mode === "insert") {
      return { handled: this.insertModeKey(key) };
    }
    if (this.pending) return this.resolvePending(key);

    const handled = this.normalModeKey(key, shift);
    if (!handled) {
      // Not simulated, but if it's a real meow command a vimmer will fat-finger
      // (e.g. v / meow-visit), still surface the nudge so they learn the clash.
      const hint = lookupVimHint(key);
      return hint ? { handled: true, vimHint: { key, ...hint } } : { handled };
    }

    // A key that started a pending argument (f, t, , .) just shows a prompt.
    if (this.pending) return { handled, echo: this.pendingPrompt() };

    const hint = lookupVimHint(key);
    return hint ? { handled, vimHint: { key, ...hint } } : { handled };
  }

  private resolvePending(key: string): KeyResult {
    const p = this.pending;
    this.pending = null;
    if (key === "Escape" || key === "Enter") return { handled: true };
    switch (p) {
      case "find":
        this.findChar(key, true);
        break;
      case "till":
        this.findChar(key, false);
        break;
      case "inner":
        this.thing(key, "inner");
        break;
      case "bounds":
        this.thing(key, "bounds");
        break;
    }
    return { handled: true };
  }

  private pendingPrompt(): string {
    switch (this.pending) {
      case "find":
        return "f-  find: type a character to select up to and including it";
      case "till":
        return "t-  till: type a character to select up to it";
      case "inner":
        return "inner-  thing: r ( )  s [ ]  c { }  g \" \"  l line  p paragraph  b buffer";
      case "bounds":
        return "bounds-  thing: r ( )  s [ ]  c { }  g \" \"  l line  p paragraph  b buffer";
      default:
        return "";
    }
  }

  // -------------------------------------------------------------------------
  // Insert mode
  // -------------------------------------------------------------------------

  private insertModeKey(key: string): boolean {
    const s = this.state;
    if (key === "Escape") {
      s.mode = "normal";
      // Step back onto the last typed char, vim-style, when possible.
      if (s.active.col > 0) s.active.col -= 1;
      this.collapse();
      return true;
    }
    if (key === "Enter") {
      this.snapshot();
      const line = s.lines[s.active.row];
      const before = line.slice(0, s.active.col);
      const after = line.slice(s.active.col);
      s.lines.splice(s.active.row, 1, before, after);
      s.active = { row: s.active.row + 1, col: 0 };
      this.collapse();
      return true;
    }
    if (key === "Backspace") {
      this.snapshot();
      if (s.active.col > 0) {
        const line = s.lines[s.active.row];
        s.lines[s.active.row] =
          line.slice(0, s.active.col - 1) + line.slice(s.active.col);
        s.active.col -= 1;
      } else if (s.active.row > 0) {
        const prev = s.lines[s.active.row - 1];
        const cur = s.lines[s.active.row];
        const col = prev.length;
        s.lines.splice(s.active.row - 1, 2, prev + cur);
        s.active = { row: s.active.row - 1, col };
      }
      this.collapse();
      return true;
    }
    if (key === "Delete") {
      // Forward delete (Mac: fn+Delete): remove the char under the cursor.
      this.snapshot();
      const line = s.lines[s.active.row];
      if (s.active.col < line.length) {
        s.lines[s.active.row] =
          line.slice(0, s.active.col) + line.slice(s.active.col + 1);
      } else if (s.active.row < s.lines.length - 1) {
        const next = s.lines[s.active.row + 1];
        s.lines.splice(s.active.row, 2, line + next);
      }
      this.collapse();
      return true;
    }
    if (key.length === 1) {
      this.snapshot();
      const line = s.lines[s.active.row];
      s.lines[s.active.row] =
        line.slice(0, s.active.col) + key + line.slice(s.active.col);
      s.active.col += 1;
      this.collapse();
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------------------
  // Normal mode dispatch
  // -------------------------------------------------------------------------

  private normalModeKey(key: string, _shift: boolean): boolean {
    switch (key) {
      // --- movement (collapses selection) ---
      case "h":
        this.move(0, -1);
        return true;
      case "l":
        this.move(0, 1);
        return true;
      case "j":
        this.move(1, 0);
        return true;
      case "k":
        this.move(-1, 0);
        return true;

      // --- word / symbol motions (leave a selection) ---
      case "e":
        this.nextToken(false);
        return true;
      case "E":
        this.nextToken(true);
        return true;
      case "b":
        this.backToken(false);
        return true;
      case "B":
        this.backToken(true);
        return true;
      case "w":
        this.markToken(false);
        return true;
      case "W":
        this.markToken(true);
        return true;

      // --- line selection ---
      case "x":
        this.selectLine();
        return true;

      // --- find / till (await a target character) ---
      case "f":
        this.pending = "find";
        return true;
      case "t":
        this.pending = "till";
        return true;

      // --- inner / bounds of a THING (await a thing key) ---
      case ",":
        this.pending = "inner";
        return true;
      case ".":
        this.pending = "bounds";
        return true;

      // --- block selection (matching brackets) ---
      case "o":
        this.block(false);
        return true;
      case "O":
        this.block(true);
        return true;

      // --- expand selection by char ---
      case "H":
        this.expand(0, -1);
        return true;
      case "L":
        this.expand(0, 1);
        return true;
      case "J":
        this.expand(1, 0);
        return true;
      case "K":
        this.expand(-1, 0);
        return true;

      // --- selection management ---
      case ";":
        this.reverse();
        return true;
      case "g":
      case "Escape":
        this.collapse();
        return true;

      // --- edits ---
      case "d":
      case "Delete": // forward-delete key behaves like meow-delete in Normal
        this.deleteRegion(false);
        return true;
      case "s":
        this.deleteRegion(true);
        return true;
      case "c":
        this.change();
        return true;
      case "i":
        this.enterInsert("start");
        return true;
      case "a":
        this.enterInsert("end");
        return true;
      case "I":
        this.openLine("above");
        return true;
      case "A":
        this.openLine("below");
        return true;

      // --- clipboard ---
      case "y":
        this.save();
        return true;
      case "p":
        this.paste();
        return true;
      case "r":
        this.replace();
        return true;

      // --- history ---
      case "u":
        this.undo();
        return true;

      default:
        if (/^[0-9]$/.test(key)) {
          this.expandN(parseInt(key, 10));
          return true;
        }
        return false;
    }
  }

  // -------------------------------------------------------------------------
  // Movement
  // -------------------------------------------------------------------------

  private move(dr: number, dc: number): void {
    const s = this.state;
    let { row, col } = s.active;
    if (dr !== 0) {
      row = Math.max(0, Math.min(row + dr, s.lines.length - 1));
      col = Math.min(s.goalCol, s.lines[row].length);
    } else {
      col = Math.max(0, Math.min(col + dc, s.lines[row].length));
      s.goalCol = col;
    }
    this.collapse({ row, col });
  }

  private expand(dr: number, dc: number): void {
    const s = this.state;
    if (s.kind === null) s.kind = "char";
    let { row, col } = s.active;
    if (dr !== 0) {
      row = Math.max(0, Math.min(row + dr, s.lines.length - 1));
      col = Math.min(col, s.lines[row].length);
    } else {
      col = Math.max(0, Math.min(col + dc, s.lines[row].length));
    }
    s.active = { row, col };
  }

  private reverse(): void {
    if (this.state.kind === null) return;
    const tmp = this.state.anchor;
    this.state.anchor = this.state.active;
    this.state.active = tmp;
  }

  // -------------------------------------------------------------------------
  // Word / symbol selection
  // -------------------------------------------------------------------------

  private nextToken(symbol: boolean): void {
    const s = this.state;
    const inTok = symbol ? isSymbolChar : isWordChar;
    const wantKind: SelectionKind = symbol ? "symbol" : "word";
    // Only an *expandable* same-kind selection (from w) extends; a bare e makes
    // a fresh non-expandable selection, so repeating e moves word-by-word.
    const extending = s.kind === wantKind && s.expandable;

    let p: Pos | null = clone(s.active);
    if (extending) {
      // Grow the active end forward over the next token; keep the anchor.
      while (p && !inTok(charAt(s.lines, p))) p = nextPos(s.lines, p);
      while (p && inTok(charAt(s.lines, p))) p = nextPos(s.lines, p);
      s.active = p ? clone(p) : this.bufferEnd();
    } else {
      // Fresh: select the next whole token.
      while (p && !inTok(charAt(s.lines, p))) p = nextPos(s.lines, p);
      s.anchor = p ? clone(p) : clone(s.active);
      let e: Pos | null = p ? clone(p) : null;
      while (e && inTok(charAt(s.lines, e))) e = nextPos(s.lines, e);
      s.active = e ? clone(e) : this.bufferEnd();
      s.expandable = false;
    }
    s.kind = wantKind;
  }

  private backToken(symbol: boolean): void {
    const s = this.state;
    const inTok = symbol ? isSymbolChar : isWordChar;
    const wantKind: SelectionKind = symbol ? "symbol" : "word";
    const extending = s.kind === wantKind && s.expandable;

    if (extending) {
      // Grow the active end backward over the previous token; keep the anchor.
      let p = clone(s.active);
      let prev = prevPos(s.lines, p);
      while (prev && !inTok(charAt(s.lines, prev))) {
        p = prev;
        prev = prevPos(s.lines, p);
      }
      prev = prevPos(s.lines, p);
      while (prev && inTok(charAt(s.lines, prev))) {
        p = prev;
        prev = prevPos(s.lines, p);
      }
      s.active = clone(p);
    } else {
      // Fresh: select the previous whole token (active at its start).
      let end = clone(s.active);
      let prev = prevPos(s.lines, end);
      while (prev && !inTok(charAt(s.lines, prev))) {
        end = prev;
        prev = prevPos(s.lines, end);
      }
      let start = clone(end);
      prev = prevPos(s.lines, start);
      while (prev && inTok(charAt(s.lines, prev))) {
        start = prev;
        prev = prevPos(s.lines, start);
      }
      s.anchor = clone(end);
      s.active = clone(start);
      s.expandable = false;
    }
    s.kind = wantKind;
  }

  private markToken(symbol: boolean): void {
    const s = this.state;
    const inTok = symbol ? isSymbolChar : isWordChar;

    // Find a probe position *inside* the word to mark — the word at point, in
    // the Emacs `bounds-of-thing-at-point` sense. Crucially, when the cursor is
    // at a word's trailing edge (where w leaves it), we re-mark THAT word rather
    // than walking forward — so pressing w repeatedly is idempotent, matching
    // meow. Use e / b to move/expand to other words.
    let probe: Pos | null = clone(s.active);
    if (!inTok(charAt(s.lines, probe))) {
      const before = prevPos(s.lines, probe);
      if (before && inTok(charAt(s.lines, before))) {
        probe = before;
      } else {
        let p: Pos | null = clone(probe);
        while (p && !inTok(charAt(s.lines, p))) p = nextPos(s.lines, p);
        probe = p;
      }
    }
    if (!probe) return;

    // Expand left to the token start.
    let start = clone(probe);
    let prev = prevPos(s.lines, start);
    while (prev && inTok(charAt(s.lines, prev))) {
      start = prev;
      prev = prevPos(s.lines, start);
    }
    // Expand right to the token end.
    let end: Pos | null = clone(probe);
    while (end && inTok(charAt(s.lines, end))) end = nextPos(s.lines, end);
    s.anchor = clone(start);
    s.active = end ? clone(end) : this.bufferEnd();
    s.kind = symbol ? "symbol" : "word";
    s.expandable = true; // w makes an expandable selection; e / b extend it
  }

  private bufferEnd(): Pos {
    const row = this.state.lines.length - 1;
    return { row, col: this.state.lines[row].length };
  }

  // -------------------------------------------------------------------------
  // Find / till
  // -------------------------------------------------------------------------

  private findChar(ch: string, inclusive: boolean): void {
    const s = this.state;
    let p = nextPos(s.lines, s.active);
    while (p && charAt(s.lines, p) !== ch) p = nextPos(s.lines, p);
    if (!p) return; // not found — leave things as they are
    s.anchor = clone(s.active);
    s.active = inclusive ? (nextPos(s.lines, p) ?? this.bufferEnd()) : clone(p);
    s.kind = "char";
  }

  // -------------------------------------------------------------------------
  // THING selection (meow's answer to vim text objects)
  // -------------------------------------------------------------------------

  private flatText(): string {
    return this.state.lines.join("\n");
  }
  private lineStarts(): number[] {
    const starts: number[] = [];
    let off = 0;
    for (const line of this.state.lines) {
      starts.push(off);
      off += line.length + 1; // + newline
    }
    return starts;
  }
  private posToOffset(p: Pos): number {
    return this.lineStarts()[p.row] + p.col;
  }
  private offsetToPos(o: number): Pos {
    const starts = this.lineStarts();
    let row = 0;
    for (let r = 0; r < starts.length; r++) {
      if (starts[r] <= o) row = r;
      else break;
    }
    return { row, col: o - starts[row] };
  }
  private selByOffsets(a: number, b: number): void {
    this.state.anchor = this.offsetToPos(a);
    this.state.active = this.offsetToPos(b);
    this.state.kind = "char";
  }

  private thing(suffix: string, mode: "inner" | "bounds"): void {
    const pairs: Record<string, [string, string]> = {
      r: ["(", ")"],
      s: ["[", "]"],
      c: ["{", "}"],
    };
    if (pairs[suffix]) {
      this.bracketThing(pairs[suffix][0], pairs[suffix][1], mode);
    } else if (suffix === "g") {
      this.quoteThing(mode);
    } else if (suffix === "l") {
      this.lineThing(mode);
    } else if (suffix === "p") {
      this.paragraphThing();
    } else if (suffix === "b") {
      const last = this.state.lines.length - 1;
      this.state.anchor = { row: 0, col: 0 };
      this.state.active = { row: last, col: this.state.lines[last].length };
      this.state.kind = "char";
    }
  }

  /** Index of the close matching the open at `openIdx`, or -1. */
  private matchForward(
    text: string,
    openIdx: number,
    open: string,
    close: string,
  ): number {
    let depth = 0;
    for (let j = openIdx + 1; j < text.length; j++) {
      const c = text[j];
      if (c === open) depth++;
      else if (c === close) {
        if (depth === 0) return j;
        depth--;
      }
    }
    return -1;
  }

  /** The innermost [openIdx, closeIdx] of `open`/`close` enclosing `idx`. */
  private enclosingPair(
    text: string,
    idx: number,
    open: string,
    close: string,
  ): [number, number] | null {
    let depth = 0;
    let openIdx = -1;
    for (let j = idx; j >= 0; j--) {
      const c = text[j];
      if (c === close && j !== idx) depth++;
      else if (c === open) {
        if (depth === 0) {
          openIdx = j;
          break;
        }
        depth--;
      }
    }
    if (openIdx < 0) return null;
    const closeIdx = this.matchForward(text, openIdx, open, close);
    return closeIdx < 0 ? null : [openIdx, closeIdx];
  }

  /**
   * The bracket pair nearest to `idx`: an enclosing pair if the cursor is inside
   * one (innermost wins), otherwise the closest pair anywhere in the buffer.
   * This matches meow's behaviour — pressing `o` jumps to the nearest block, you
   * don't have to navigate inside it first.
   */
  private nearestPair(text: string, idx: number): [number, number] | null {
    const types: [string, string][] = [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ];
    // 1) Prefer an enclosing pair; among types, the innermost (largest open).
    let enclosing: [number, number] | null = null;
    for (const [o, c] of types) {
      const p = this.enclosingPair(text, idx, o, c);
      if (p && (!enclosing || p[0] > enclosing[0])) enclosing = p;
    }
    if (enclosing) return enclosing;

    // 2) Otherwise, the pair whose span is closest to the cursor.
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    const openers = new Map(types.map(([o, c]) => [o, c]));
    for (let i = 0; i < text.length; i++) {
      const close = openers.get(text[i]);
      if (!close) continue;
      const closeIdx = this.matchForward(text, i, text[i], close);
      if (closeIdx < 0) continue;
      const dist = idx < i ? i - idx : idx > closeIdx ? idx - closeIdx : 0;
      if (dist < bestDist) {
        bestDist = dist;
        best = [i, closeIdx];
      }
    }
    return best;
  }

  private bracketThing(
    open: string,
    close: string,
    mode: "inner" | "bounds",
  ): void {
    const pair = this.enclosingPair(
      this.flatText(),
      this.posToOffset(this.state.active),
      open,
      close,
    );
    if (!pair) return;
    if (mode === "inner") this.selByOffsets(pair[0] + 1, pair[1]);
    else this.selByOffsets(pair[0], pair[1] + 1);
  }

  /**
   * meow-block (o): select the nearest bracket pair around the cursor, including
   * the brackets. meow-to-block (O, outward=true): jump out one level.
   */
  private block(outward: boolean): void {
    const text = this.flatText();
    let idx = this.posToOffset(this.state.active);
    if (outward && this.state.kind !== null) {
      // Step just outside the current block so O reaches the enclosing one.
      const [start] = ordered(this.state.anchor, this.state.active);
      idx = Math.max(0, this.posToOffset(start) - 1);
    }
    const pair = this.nearestPair(text, idx);
    if (!pair) return;
    this.selByOffsets(pair[0], pair[1] + 1);
  }

  private quoteThing(mode: "inner" | "bounds"): void {
    const text = this.flatText();
    const idx = this.posToOffset(this.state.active);

    let qi = -1;
    let qc = "";
    for (let j = idx; j >= 0; j--) {
      if (text[j] === '"' || text[j] === "'") {
        qi = j;
        qc = text[j];
        break;
      }
    }
    if (qi < 0) return;
    let cj = -1;
    for (let j = Math.max(idx, qi + 1); j < text.length; j++) {
      if (text[j] === qc) {
        cj = j;
        break;
      }
    }
    if (cj < 0) return;

    if (mode === "inner") this.selByOffsets(qi + 1, cj);
    else this.selByOffsets(qi, cj + 1);
  }

  private lineThing(mode: "inner" | "bounds"): void {
    const s = this.state;
    const row = s.active.row;
    if (mode === "inner") {
      s.anchor = { row, col: 0 };
      s.active = { row, col: s.lines[row].length };
      s.kind = "char";
    } else {
      s.anchor = { row, col: 0 };
      s.active = { row, col: s.lines[row].length };
      s.kind = "line";
    }
  }

  private paragraphThing(): void {
    const s = this.state;
    const row = s.active.row;
    let top = row;
    while (top > 0 && s.lines[top - 1].trim() !== "") top--;
    let bot = row;
    while (bot < s.lines.length - 1 && s.lines[bot + 1].trim() !== "") bot++;
    s.anchor = { row: top, col: 0 };
    s.active = { row: bot, col: s.lines[bot].length };
    s.kind = "line";
  }

  // -------------------------------------------------------------------------
  // Numeric expand (0-9): grow the selection by N units of its kind.
  // -------------------------------------------------------------------------

  private expandN(n: number): void {
    const s = this.state;
    if (n === 0) n = 10;
    if (s.kind === null) return;

    if (s.kind === "line") {
      const top = Math.min(s.anchor.row, s.active.row);
      const bot = Math.min(top + n - 1, s.lines.length - 1);
      s.anchor = { row: top, col: 0 };
      s.active = { row: bot, col: s.lines[bot].length };
      return;
    }
    if (s.kind === "word" || s.kind === "symbol") {
      s.active = clone(s.anchor);
      for (let i = 0; i < n; i++) this.nextToken(s.kind === "symbol");
      return;
    }
    for (let i = 0; i < n; i++) this.expand(0, 1);
  }

  // -------------------------------------------------------------------------
  // Line selection
  // -------------------------------------------------------------------------

  private selectLine(): void {
    const s = this.state;
    if (s.kind === "line") {
      const bottom = Math.min(s.active.row + 1, s.lines.length - 1);
      s.active = { row: bottom, col: s.lines[bottom].length };
      return;
    }
    const row = s.active.row;
    s.anchor = { row, col: 0 };
    s.active = { row, col: s.lines[row].length };
    s.kind = "line";
    s.expandable = true;
  }

  // -------------------------------------------------------------------------
  // Editing
  // -------------------------------------------------------------------------

  private deleteRegion(toKill: boolean): void {
    const s = this.state;
    this.snapshot();

    if (s.kind === "line") {
      const [a, b] = ordered(s.anchor, s.active);
      const top = a.row;
      const bottom = b.row;
      const removedLines = s.lines.slice(top, bottom + 1);
      s.lines.splice(top, bottom - top + 1);
      if (s.lines.length === 0) s.lines = [""];
      const newRow = Math.min(top, s.lines.length - 1);
      if (toKill) {
        s.killRing = removedLines.join("\n");
        s.killIsLine = true;
      }
      this.collapse({ row: newRow, col: 0 });
      return;
    }

    if (s.kind === null) {
      // No selection: delete the single character after the cursor.
      const ch = charAt(s.lines, s.active);
      if (ch === null) return;
      const after = nextPos(s.lines, s.active);
      if (!after) return;
      const removed = this.removeRange(s.active, after);
      if (toKill) {
        s.killRing = removed;
        s.killIsLine = false;
      }
      this.collapse(clampToLine(s.lines, s.active));
      return;
    }

    const [start, end] = ordered(s.anchor, s.active);
    const removed = this.removeRange(start, end);
    if (toKill) {
      s.killRing = removed;
      s.killIsLine = false;
    }
    this.collapse(start);
  }

  /** Remove the half-open range [start, end) and return the removed text. */
  private removeRange(start: Pos, end: Pos): string {
    const s = this.state;
    if (start.row === end.row) {
      const line = s.lines[start.row];
      const removed = line.slice(start.col, end.col);
      s.lines[start.row] = line.slice(0, start.col) + line.slice(end.col);
      return removed;
    }
    const first = s.lines[start.row];
    const last = s.lines[end.row];
    const middle = s.lines.slice(start.row + 1, end.row);
    const removed =
      first.slice(start.col) +
      "\n" +
      [...middle, last.slice(0, end.col)].join("\n");
    const merged = first.slice(0, start.col) + last.slice(end.col);
    s.lines.splice(start.row, end.row - start.row + 1, merged);
    return removed;
  }

  private change(): void {
    const s = this.state;
    if (s.kind === "line") {
      // Change a line: empty it and drop into insert at its start.
      this.snapshot();
      const [a, b] = ordered(s.anchor, s.active);
      s.killRing = s.lines.slice(a.row, b.row + 1).join("\n") + "\n";
      s.lines.splice(a.row, b.row - a.row + 1, "");
      s.mode = "insert";
      this.collapse({ row: a.row, col: 0 });
      return;
    }
    if (s.kind === null) {
      s.mode = "insert";
      this.collapse();
      return;
    }
    this.snapshot();
    const [start, end] = ordered(s.anchor, s.active);
    s.killRing = this.removeRange(start, end);
    s.mode = "insert";
    this.collapse(start);
  }

  private enterInsert(where: "start" | "end"): void {
    const s = this.state;
    let pos: Pos;
    if (s.kind !== null) {
      const [start, end] = ordered(s.anchor, s.active);
      pos = where === "start" ? clone(start) : clone(end);
    } else if (where === "end") {
      const line = s.lines[s.active.row];
      pos = { row: s.active.row, col: Math.min(s.active.col + 1, line.length) };
    } else {
      pos = clone(s.active);
    }
    s.mode = "insert";
    this.collapse(pos);
  }

  private openLine(where: "above" | "below"): void {
    const s = this.state;
    this.snapshot();
    const row = where === "below" ? s.active.row + 1 : s.active.row;
    s.lines.splice(row, 0, "");
    s.mode = "insert";
    this.collapse({ row, col: 0 });
  }

  private save(): void {
    const s = this.state;
    if (s.kind === null) return;
    if (s.kind === "line") {
      const [a, b] = ordered(s.anchor, s.active);
      s.killRing = s.lines.slice(a.row, b.row + 1).join("\n");
      s.killIsLine = true;
      return;
    }
    const [start, end] = ordered(s.anchor, s.active);
    s.killRing = this.sliceText(start, end);
    s.killIsLine = false;
  }

  private sliceText(start: Pos, end: Pos): string {
    const s = this.state;
    if (start.row === end.row) {
      return s.lines[start.row].slice(start.col, end.col);
    }
    const first = s.lines[start.row].slice(start.col);
    const middle = s.lines.slice(start.row + 1, end.row);
    const last = s.lines[end.row].slice(0, end.col);
    return [first, ...middle, last].join("\n");
  }

  private paste(): void {
    const s = this.state;
    if (!s.killRing) return;
    this.snapshot();
    const text = s.killRing;

    // Linewise paste: drop the saved line(s) on their own line below.
    if (s.killIsLine) {
      const newLines = text.split("\n");
      s.lines.splice(s.active.row + 1, 0, ...newLines);
      this.collapse({ row: s.active.row + 1, col: 0 });
      return;
    }

    const parts = text.split("\n");
    const line = s.lines[s.active.row];
    const before = line.slice(0, s.active.col);
    const after = line.slice(s.active.col);

    if (parts.length === 1) {
      s.lines[s.active.row] = before + text + after;
      this.collapse({ row: s.active.row, col: s.active.col + text.length });
      return;
    }
    // Multi-line paste (e.g. a killed line).
    const newLines = [
      before + parts[0],
      ...parts.slice(1, -1),
      parts[parts.length - 1] + after,
    ];
    s.lines.splice(s.active.row, 1, ...newLines);
    this.collapse({ row: s.active.row, col: 0 });
  }

  /**
   * meow-replace (r): overwrite the current selection with the kill-ring. The
   * replaced text is NOT saved to the kill-ring (unlike kill).
   */
  private replace(): void {
    const s = this.state;
    if (s.kind === null || !s.killRing) return;
    this.snapshot();
    const text = s.killRing;

    if (s.kind === "line") {
      const [a, b] = ordered(s.anchor, s.active);
      s.lines.splice(a.row, b.row - a.row + 1, ...text.split("\n"));
      if (s.lines.length === 0) s.lines = [""];
      this.collapse({ row: a.row, col: 0 });
      return;
    }

    const [start, end] = ordered(s.anchor, s.active);
    this.removeRange(start, end); // discard removed (not saved to kill-ring)
    const parts = text.split("\n");
    const line = s.lines[start.row];
    const before = line.slice(0, start.col);
    const after = line.slice(start.col);
    if (parts.length === 1) {
      s.lines[start.row] = before + text + after;
      this.collapse({ row: start.row, col: start.col + text.length });
    } else {
      const newLines = [
        before + parts[0],
        ...parts.slice(1, -1),
        parts[parts.length - 1] + after,
      ];
      s.lines.splice(start.row, 1, ...newLines);
      this.collapse({ row: start.row, col: 0 });
    }
  }

  private undo(): void {
    const snap = this.undoStack.pop();
    if (!snap) return;
    const s = this.state;
    s.lines = [...snap.lines];
    s.anchor = clone(snap.anchor);
    s.active = clone(snap.active);
    s.kind = snap.kind;
  }
}
