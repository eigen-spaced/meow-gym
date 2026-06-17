import { MeowEngine } from "./meow";
import type { EditorState, Pos, VimHint } from "./types";
import { KEYMAP } from "../app/keymap";
import { getRelativeNumbers } from "../app/settings";

function cmp(a: Pos, b: Pos): number {
  return a.row !== b.row ? a.row - b.row : a.col - b.col;
}

const COMMAND_BY_KEY = new Map(KEYMAP.map((b) => [b.key, b.command]));

/** A half-open [start, end) span to highlight as a goal target in the buffer. */
export interface TargetSpan {
  start: Pos;
  end: Pos;
  /** Optional CSS class for color-coding the job (t-del / t-fix / t-yank). */
  cls?: string;
}

export interface EditorViewOptions {
  lines: string[];
  /** Buffer name shown in the modeline, e.g. "*gym*". */
  bufferName?: string;
  /** Goal regions to highlight in the buffer (distinct from the selection). */
  targets?: TargetSpan[];
  /** Called after every handled key, with the fresh state. */
  onChange?: (state: EditorState) => void;
  /** Called when a vim muscle-memory key is pressed. */
  onVimHint?: (hint: VimHint) => void;
  /** Called for every handled keystroke (the raw key). For scoring/timing. */
  onKey?: (key: string) => void;
  /** Show "you're thinking in vim" nudges in the echo area. Default true. */
  vimHints?: boolean;
}

const IDLE_ECHO =
  '<span class="echo-dim">C-h b for bindings · i to insert, Esc for normal</span>';

/**
 * A focusable widget shaped like an Emacs window: a buffer, a modeline, and an
 * echo area (minibuffer). Keystrokes route into the meow engine; the echo area
 * surfaces messages, including the "vim habit" nudges, the way Emacs would.
 */
export class EditorView {
  readonly el: HTMLDivElement;
  readonly engine: MeowEngine;
  private bufferEl: HTMLDivElement;
  private modelineEl: HTMLDivElement;
  private echoEl: HTMLDivElement;
  private opts: EditorViewOptions;
  private bufferName: string;
  private initialText: string;
  private targets: TargetSpan[];
  private echoTimer?: number;

  constructor(opts: EditorViewOptions) {
    this.opts = opts;
    this.bufferName = opts.bufferName ?? "*gym*";
    this.targets = opts.targets ?? [];
    this.initialText = opts.lines.join("\n");
    this.engine = new MeowEngine(opts.lines);

    this.el = document.createElement("div");
    this.el.className = "emacs-frame";

    this.bufferEl = document.createElement("div");
    this.bufferEl.className = "editor";
    this.bufferEl.tabIndex = 0;
    this.bufferEl.setAttribute("role", "textbox");
    this.bufferEl.setAttribute("aria-label", "meow practice buffer");
    this.bufferEl.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.bufferEl.addEventListener("focus", () => this.renderModeline());
    this.bufferEl.addEventListener("blur", () => this.renderModeline());

    this.modelineEl = document.createElement("div");
    this.modelineEl.className = "modeline";

    this.echoEl = document.createElement("div");
    this.echoEl.className = "echo-area";

    this.el.append(this.bufferEl, this.modelineEl, this.echoEl);
    this.render();
    this.setEcho(IDLE_ECHO, "idle");
  }

  reset(lines: string[]): void {
    this.initialText = lines.join("\n");
    this.engine.reset(lines);
    this.render();
    this.setEcho(IDLE_ECHO, "idle");
  }

  /** Replace the highlighted goal targets (used as multi-task puzzles advance). */
  setTargets(targets: TargetSpan[]): void {
    this.targets = targets;
    this.renderBuffer();
  }

  focus(): void {
    this.bufferEl.focus();
  }

  /** Set the echo-area message (the minibuffer line). */
  setEcho(html: string, kind: "idle" | "info" | "warn" = "info"): void {
    window.clearTimeout(this.echoTimer);
    this.echoEl.className = `echo-area echo-${kind}`;
    this.echoEl.innerHTML = html;
    if (kind !== "idle") {
      this.echoTimer = window.setTimeout(
        () => this.setEcho(IDLE_ECHO, "idle"),
        8000,
      );
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const key = e.key;
    const known =
      key.length === 1 ||
      key === "Escape" ||
      key === "Enter" ||
      key === "Backspace" ||
      key === "Delete";
    if (!known) return;

    e.preventDefault();
    const result = this.engine.feed(key, e.shiftKey);
    if (!result.handled) return;

    this.render();
    this.opts.onKey?.(key);
    this.opts.onChange?.(this.engine.state);

    if (result.vimHint && this.opts.vimHints !== false) {
      this.echoVimHint(result.vimHint);
      this.opts.onVimHint?.(result.vimHint);
    } else if (result.echo) {
      this.setEcho(`<span class="echo-prompt">${escapeHtml(result.echo)}</span>`, "info");
    }
  }

  private echoVimHint(hint: VimHint): void {
    const cmd = COMMAND_BY_KEY.get(hint.key) ?? "meow-command";
    const html =
      `<span class="echo-warn-tag">vim habit</span> ` +
      `<kbd>${escapeHtml(hint.key)}</kbd> runs <code>${escapeHtml(cmd)}</code> — ` +
      `<span class="echo-meow">${escapeHtml(hint.meow)}</span>. ` +
      (hint.tip ? `<span class="echo-dim">${escapeHtml(hint.tip)}</span>` : "");
    this.setEcho(html, "warn");
  }

  render(): void {
    this.renderBuffer();
    this.renderModeline();
  }

  private renderBuffer(): void {
    const s = this.engine.state;
    const sel = this.engine.selectionRange();
    const relative = getRelativeNumbers();
    const frag = document.createDocumentFragment();

    s.lines.forEach((line, row) => {
      const lineEl = document.createElement("div");
      lineEl.className = "editor-line";

      const gutter = document.createElement("span");
      gutter.className = "linenr";
      // Hybrid (vim-style): current line shows its absolute number, others the
      // relative distance.
      const num =
        relative && row !== s.active.row
          ? Math.abs(row - s.active.row)
          : row + 1;
      gutter.textContent = String(num).padStart(2, " ");
      if (row === s.active.row) gutter.classList.add("linenr-cur");
      lineEl.appendChild(gutter);

      for (let col = 0; col <= line.length; col++) {
        const isTrailing = col === line.length;
        const ch = isTrailing ? " " : line[col];
        const span = document.createElement("span");
        span.className = "ch";
        span.textContent = ch === " " ? " " : ch;

        if (!isTrailing) {
          const t = this.targetAt(row, col);
          if (t) {
            span.classList.add("target-hl");
            if (t.cls) span.classList.add(t.cls);
          }
        }
        if (this.isSelected(sel, s, row, col, isTrailing)) {
          span.classList.add("sel");
        }
        if (row === s.active.row && col === s.active.col) {
          span.classList.add("cursor");
          span.classList.add(
            s.mode === "insert" ? "cursor-bar" : "cursor-block",
          );
        }
        lineEl.appendChild(span);
      }
      frag.appendChild(lineEl);
    });

    this.bufferEl.replaceChildren(frag);
  }

  private renderModeline(): void {
    const s = this.engine.state;
    const modified = s.lines.join("\n") !== this.initialText;
    const focused = document.activeElement === this.bufferEl;
    const stateName = s.mode === "insert" ? "INSERT" : "NORMAL";
    const stateClass = s.mode === "insert" ? "ml-insert" : "ml-normal";
    const pos = `L${s.active.row + 1} C${s.active.col}`;

    this.modelineEl.classList.toggle("ml-blur", !focused);
    this.modelineEl.innerHTML =
      `<span class="ml-state ${stateClass}">${stateName}</span>` +
      `<span class="ml-mod">${modified ? "**" : "--"}</span>` +
      `<span class="ml-buf">${escapeHtml(this.bufferName)}</span>` +
      `<span class="ml-major">(Meow Fundamental)</span>` +
      `<span class="ml-spacer"></span>` +
      `<span class="ml-pos">${pos}</span>`;
  }

  private targetAt(row: number, col: number): TargetSpan | undefined {
    const here = { row, col };
    return this.targets.find(
      (t) => cmp(t.start, here) <= 0 && cmp(here, t.end) < 0,
    );
  }

  private isSelected(
    sel: { start: Pos; end: Pos } | null,
    s: EditorState,
    row: number,
    col: number,
    isTrailing: boolean,
  ): boolean {
    if (!sel) return false;
    if (s.kind === "line") {
      return row >= sel.start.row && row <= sel.end.row;
    }
    if (isTrailing && row !== sel.end.row) {
      return row >= sel.start.row && row < sel.end.row;
    }
    const here = { row, col };
    return cmp(sel.start, here) <= 0 && cmp(here, sel.end) < 0;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
