import { EditorView } from "../editor/EditorView";
import type { TargetSpan } from "../editor/EditorView";
import type { EditorState } from "../editor/types";
import {
  checkPuzzle,
  gradeRun,
  tasksOf,
  type Puzzle,
  type PuzzleTask,
  type Score,
} from "./puzzles";
import { legendHtml, legendHtmlFromCls } from "./progress";
import { nextBeacon } from "./diff";

interface Best {
  keys: number;
  ms: number;
}

function bestKey(id: string): string {
  return `meow-gym.best.${id}`;
}
function loadBest(id: string): Best | null {
  try {
    const raw = localStorage.getItem(bestKey(id));
    return raw ? (JSON.parse(raw) as Best) : null;
  } catch {
    return null;
  }
}
function saveBest(id: string, b: Best): void {
  try {
    localStorage.setItem(bestKey(id), JSON.stringify(b));
  } catch {
    /* ignore */
  }
}

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export interface PuzzleViewCallbacks {
  /** Called when this puzzle is solved (with its id, for progress tracking). */
  onSolved?: (id: string) => void;
  /** Advance to the next puzzle in the group. */
  onNext?: () => void;
  hasNext: boolean;
}

/** Renders one puzzle: editor, a live HUD, and a graded result. */
export class PuzzleView {
  readonly el: HTMLDivElement;
  private editor: EditorView;
  private hudEl!: HTMLDivElement;
  private resultEl!: HTMLDivElement;
  private nextBtn!: HTMLButtonElement;

  private tasks: PuzzleTask[];
  private taskIndex = 0;
  private taskStartBuf = "";
  private readonly diffMode: boolean;
  private diffTarget: string[];
  private keys = 0;
  private movementKeys = 0;
  private startMs: number | null = null;
  private tick?: number;
  private done = false;

  constructor(
    private puzzle: Puzzle,
    private cb: PuzzleViewCallbacks,
  ) {
    this.tasks = tasksOf(puzzle);
    this.taskStartBuf = puzzle.buffer.join("\n");
    this.diffMode = !!puzzle.diff;
    this.diffTarget = puzzle.target ?? [];

    this.el = document.createElement("div");
    this.el.className = "puzzle";

    this.editor = new EditorView({
      lines: puzzle.buffer,
      bufferName: `*puzzle:${puzzle.id}*`,
      targets: this.diffMode
        ? this.beacon(puzzle.buffer)
        : this.tasks[0]?.targets,
      onKey: (k) => this.onKey(k),
      onChange: (s) => this.onChange(s),
    });

    this.build();
    requestAnimationFrame(() => this.editor.focus());
  }

  private currentTargets(): TargetSpan[] {
    return this.tasks[this.taskIndex]?.targets ?? [];
  }

  /** The live diff beacon for a buffer (diff puzzles), as a targets array. */
  private beacon(lines: string[]): TargetSpan[] {
    const b = nextBeacon(lines, this.diffTarget);
    return b ? [b] : [];
  }

  private build(): void {
    const p = this.puzzle;

    const blurb = document.createElement("p");
    blurb.className = "prose puzzle-blurb";
    blurb.textContent = p.blurb;
    this.el.append(blurb);

    // Color legend for highlighted jobs.
    const legend = this.diffMode
      ? legendHtmlFromCls(p.legendCls ?? [])
      : legendHtml(this.tasks.flatMap((t) => t.targets ?? []));
    if (legend) {
      const legendEl = document.createElement("div");
      legendEl.className = "legend";
      legendEl.innerHTML = legend;
      this.el.append(legendEl);
    }

    // Target reference panel — only for puzzles that reproduce a target text.
    const showTarget =
      !!p.target &&
      (p.kind === "fix" || p.kind === "golf" || p.kind === "timed");
    if (showTarget && p.target) {
      const target = document.createElement("div");
      target.className = "target-panel";
      target.innerHTML =
        `<div class="target-label">target</div>` +
        `<pre class="target-text">${escapeHtml(p.target.join("\n"))}</pre>`;
      this.el.append(target);
    }

    const editorWrap = document.createElement("div");
    editorWrap.className = "editor-wrap";
    editorWrap.append(this.editor.el);
    this.el.append(editorWrap);

    this.hudEl = document.createElement("div");
    this.hudEl.className = "hud";
    this.el.append(this.hudEl);
    this.renderHud();

    this.resultEl = document.createElement("div");
    this.resultEl.className = "result";
    this.el.append(this.resultEl);

    const controls = document.createElement("div");
    controls.className = "controls";

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn";
    resetBtn.textContent = "Reset puzzle";
    resetBtn.addEventListener("click", () => this.reset());

    this.nextBtn = document.createElement("button");
    this.nextBtn.className = "btn btn-primary";
    this.nextBtn.textContent = this.cb.hasNext ? "Next puzzle →" : "Finish group";
    this.nextBtn.disabled = true;
    this.nextBtn.addEventListener("click", () => this.cb.onNext?.());

    controls.append(resetBtn, this.nextBtn);
    this.el.append(controls);
  }

  private reset(): void {
    this.keys = 0;
    this.movementKeys = 0;
    this.taskIndex = 0;
    this.taskStartBuf = this.puzzle.buffer.join("\n");
    this.startMs = null;
    this.done = false;
    window.clearInterval(this.tick);
    this.editor.reset(this.puzzle.buffer);
    this.editor.setTargets(
      this.diffMode ? this.beacon(this.puzzle.buffer) : this.currentTargets(),
    );
    this.resultEl.className = "result";
    this.resultEl.innerHTML = "";
    this.nextBtn.disabled = true;
    this.nextBtn.classList.remove("ready");
    this.renderHud();
    this.editor.focus();
  }

  private elapsed(): number {
    return this.startMs === null ? 0 : Date.now() - this.startMs;
  }

  private onKey(key: string): void {
    if (this.done) return;
    if (this.startMs === null) {
      this.startMs = Date.now();
      this.tick = window.setInterval(() => this.renderHud(), 100);
    }
    this.keys++;
    if (key === "h" || key === "j" || key === "k" || key === "l") {
      this.movementKeys++;
    }
    this.renderHud();
  }

  private renderHud(): void {
    const p = this.puzzle;
    const best = loadBest(p.id);
    const timer = p.kind === "timed";
    this.hudEl.innerHTML =
      `<span class="hud-item">keys <b>${this.keys}</b></span>` +
      (timer
        ? `<span class="hud-item">time <b>${fmtMs(this.elapsed())}</b></span>`
        : "") +
      `<span class="hud-item hud-dim">par ${p.par}</span>` +
      (best
        ? `<span class="hud-item hud-dim">best ${best.keys} keys${
            p.kind === "timed" ? ` · ${fmtMs(best.ms)}` : ""
          }</span>`
        : "");
  }

  private onChange(state: EditorState): void {
    if (this.done) return;

    if (this.diffMode) {
      const b = this.beacon(state.lines);
      this.editor.setTargets(b);
      if (b.length === 0) this.finish();
      return;
    }

    const before = this.taskIndex;
    while (
      this.taskIndex < this.tasks.length &&
      checkPuzzle(this.tasks[this.taskIndex].goal, state)
    ) {
      this.taskIndex++;
    }
    if (this.taskIndex !== before) {
      this.editor.setTargets(this.currentTargets());
      this.taskStartBuf = state.lines.join("\n");
    } else if (state.lines.join("\n") !== this.taskStartBuf) {
      // Started editing the beacon — clear it to avoid stale overlap.
      this.editor.setTargets([]);
    }

    if (this.taskIndex >= this.tasks.length) this.finish();
  }

  private finish(): void {
    this.done = true;
    window.clearInterval(this.tick);
    const ms = this.elapsed();
    const score = gradeRun(this.puzzle.par, this.keys, this.movementKeys);
    this.recordBest(ms);
    this.renderHud();
    this.renderResult(score, ms);
    this.nextBtn.disabled = false;
    this.nextBtn.classList.add("ready");
    this.editor.setEcho('<span class="echo-ok">Solved.</span>', "info");
    this.cb.onSolved?.(this.puzzle.id);
  }

  private recordBest(ms: number): void {
    const prev = loadBest(this.puzzle.id);
    if (
      !prev ||
      this.keys < prev.keys ||
      (this.keys === prev.keys && ms < prev.ms)
    ) {
      saveBest(this.puzzle.id, { keys: this.keys, ms });
    }
  }

  private renderResult(score: Score, ms: number): void {
    const p = this.puzzle;
    this.resultEl.className = `result result-show grade-${score.grade}`;
    this.resultEl.innerHTML =
      `<div class="result-grade">${score.grade}</div>` +
      `<div class="result-body">` +
      `<div class="result-line"><b>Solved</b> — ${score.keys} keys` +
      `${p.kind === "timed" ? ` in ${fmtMs(ms)}` : ""}` +
      ` (par ${p.par}).</div>` +
      (score.note ? `<div class="result-note">${escapeHtml(score.note)}</div>` : "") +
      `</div>`;
  }

  destroy(): void {
    window.clearInterval(this.tick);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
