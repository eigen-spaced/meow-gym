import { EditorView } from "../editor/EditorView";
import type { EditorState, TargetSpan } from "../editor/types";
import { checkPuzzle, tasksOf, type Puzzle, type PuzzleTask } from "./puzzles";
import { gradeRun, type Score } from "./grading";
import { legendHtml, legendHtmlFromCls } from "./progress";
import { nextBeacon } from "./diff";
import { escapeHtml } from "../app/html";
import { loadJson, saveJson } from "../app/storage";

interface Best {
  keys: number;
  ms: number;
}

const bestKey = (id: string) => `meow-gym.best.${id}`;
const loadBest = (id: string) => loadJson<Best | null>(bestKey(id), null);
const saveBest = (id: string, b: Best) => saveJson(bestKey(id), b);

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
    if (p.target && (p.kind === "fix" || p.kind === "golf")) {
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

  private onKey(key: string): void {
    if (this.done) return;
    if (this.startMs === null) this.startMs = Date.now();
    this.keys++;
    if (key === "h" || key === "j" || key === "k" || key === "l") {
      this.movementKeys++;
    }
    this.renderHud();
  }

  private renderHud(): void {
    const p = this.puzzle;
    const best = loadBest(p.id);
    this.hudEl.innerHTML =
      `<span class="hud-item">keys <b>${this.keys}</b></span>` +
      `<span class="hud-item hud-dim">par ${p.par}</span>` +
      (best ? `<span class="hud-item hud-dim">best ${best.keys} keys</span>` : "");
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
    const ms = this.startMs === null ? 0 : Date.now() - this.startMs;
    const score = gradeRun(this.puzzle.par, this.keys, this.movementKeys);
    this.recordBest(ms);
    this.renderHud();
    this.renderResult(score);
    this.nextBtn.disabled = false;
    this.nextBtn.classList.add("ready");
    this.editor.setEcho('<span class="echo-ok">Solved.</span>', "info");
    this.cb.onSolved?.(this.puzzle.id);
  }

  private recordBest(ms: number): void {
    const prev = loadBest(this.puzzle.id);
    // Best = fewest keys; ties broken by faster time.
    if (
      !prev ||
      this.keys < prev.keys ||
      (this.keys === prev.keys && ms < prev.ms)
    ) {
      saveBest(this.puzzle.id, { keys: this.keys, ms });
    }
  }

  private renderResult(score: Score): void {
    const p = this.puzzle;
    this.resultEl.className = `result result-show grade-${score.grade}`;
    this.resultEl.innerHTML =
      `<div class="result-grade">${score.grade}</div>` +
      `<div class="result-body">` +
      `<div class="result-line"><b>Solved</b> — ${score.keys} keys (par ${p.par}).</div>` +
      (score.note ? `<div class="result-note">${escapeHtml(score.note)}</div>` : "") +
      `</div>`;
  }

  destroy(): void {
    /* nothing to clean up */
  }
}
