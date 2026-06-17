import { EditorView } from "../editor/EditorView";
import type { EditorState } from "../editor/types";
import { blockBar, legendHtml, legendHtmlFromCls } from "./progress";
import { nextBeacon } from "./diff";
import { gradeGauntlet } from "./grading";
import { escapeHtml } from "../app/html";
import { loadJson, saveJson } from "../app/storage";
import {
  checkPuzzle,
  tasksOf,
  type Puzzle,
  type PuzzleGroup,
  type PuzzleTask,
} from "./puzzles";

const bestKey = (groupId: string) => `meow-gym.gauntlet.best.${groupId}`;
const loadBest = (groupId: string) =>
  loadJson<number | null>(bestKey(groupId), null);
const saveBest = (groupId: string, ms: number) => saveJson(bestKey(groupId), ms);

function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * A continuous, timed run through N randomized puzzles. Each puzzle may itself be
 * a sequence of jobs (Oogway): only the current beacon is shown, and it advances
 * one job at a time. One clock for the whole run; scored on total time.
 */
export class GauntletView {
  readonly el: HTMLDivElement;
  private editor: EditorView;
  private barEl!: HTMLDivElement;
  private hudEl!: HTMLDivElement;
  private stageEl!: HTMLDivElement;
  private instrEl!: HTMLDivElement;
  private legendEl!: HTMLDivElement;
  private targetHost!: HTMLDivElement;
  private resultEl!: HTMLDivElement;

  private stages: Puzzle[];
  private index = 0;
  private tasks: PuzzleTask[] = [];
  private taskIndex = 0;
  /** Buffer text when the current beacon was shown — to detect edits. */
  private taskStartBuf = "";
  /** Diff mode (multi-defect text passages): beacon derived live from the diff. */
  private diffMode = false;
  private diffTarget: string[] = [];
  private keys = 0;
  private startMs: number | null = null;
  private tick?: number;
  private done = false;

  constructor(private group: PuzzleGroup) {
    this.stages = this.buildStages();

    this.el = document.createElement("div");
    this.el.className = "lesson";

    this.editor = new EditorView({
      lines: this.stages[0].buffer,
      bufferName: "*gauntlet*",
      targets: tasksOf(this.stages[0])[0]?.targets,
      vimHints: false, // the gauntlets are a test, not a tutorial
      onKey: () => this.onKey(),
      onChange: (s) => this.onChange(s),
    });

    this.build();
    this.mountStage(0, false);
    requestAnimationFrame(() => this.editor.focus());
  }

  private buildStages(): Puzzle[] {
    const rounds = this.group.rounds ?? 10;
    return Array.from({ length: rounds }, (_, i) => this.group.generate!(i));
  }

  private totalPar(): number {
    return this.stages.reduce((sum, p) => sum + p.par, 0);
  }

  private build(): void {
    const head = document.createElement("div");
    head.className = "lesson-head";
    head.innerHTML = `<h2>${escapeHtml(this.group.title)}</h2>`;

    const blurb = document.createElement("p");
    blurb.className = "prose";
    blurb.textContent = this.group.blurb;

    this.barEl = document.createElement("div");
    this.barEl.className = "progress";
    this.hudEl = document.createElement("div");
    this.hudEl.className = "hud";
    this.stageEl = document.createElement("div");
    this.stageEl.className = "stage-info";
    this.instrEl = document.createElement("div");
    this.instrEl.className = "instr";
    this.legendEl = document.createElement("div");
    this.legendEl.className = "legend";
    this.targetHost = document.createElement("div");

    const editorWrap = document.createElement("div");
    editorWrap.className = "editor-wrap";
    editorWrap.append(this.editor.el);

    this.resultEl = document.createElement("div");
    this.resultEl.className = "result";

    const controls = document.createElement("div");
    controls.className = "controls";
    const resetBtn = document.createElement("button");
    resetBtn.className = "btn";
    resetBtn.textContent = "Restart gauntlet";
    resetBtn.addEventListener("click", () => this.restart());
    controls.append(resetBtn);

    this.el.append(
      head,
      blurb,
      this.barEl,
      this.hudEl,
      this.stageEl,
      this.instrEl,
      this.legendEl,
      this.targetHost,
      editorWrap,
      this.resultEl,
      controls,
    );
    this.renderHud();
    this.renderBar();
  }

  private restart(): void {
    this.stages = this.buildStages();
    this.index = 0;
    this.keys = 0;
    this.startMs = null;
    this.done = false;
    window.clearInterval(this.tick);
    this.resultEl.className = "result";
    this.resultEl.innerHTML = "";
    this.mountStage(0, false);
    this.renderHud();
    this.renderBar();
    this.editor.focus();
  }

  private mountStage(i: number, keepFocus = true): void {
    const p = this.stages[i];
    this.editor.reset(p.buffer);
    this.stageEl.textContent = `${i + 1}/${this.stages.length} · ${p.title}`;
    this.diffMode = !!p.diff;

    if (this.diffMode) {
      this.diffTarget = p.target ?? [];
      const b = nextBeacon(p.buffer, this.diffTarget);
      this.editor.setTargets(b ? [b] : []);
      this.legendEl.innerHTML = legendHtmlFromCls(p.legendCls ?? []);
      this.instrEl.textContent = p.blurb;
    } else {
      this.tasks = tasksOf(p);
      this.taskIndex = 0;
      this.editor.setTargets(this.tasks[0]?.targets ?? []);
      this.taskStartBuf = p.buffer.join("\n");
      this.legendEl.innerHTML = legendHtml(
        this.tasks.flatMap((t) => t.targets ?? []),
      );
      this.renderInstr(p);
    }

    if (p.target) {
      this.targetHost.innerHTML =
        `<div class="target-panel"><div class="target-label">target</div>` +
        `<pre class="target-text">${escapeHtml(p.target.join("\n"))}</pre></div>`;
    } else {
      this.targetHost.replaceChildren();
    }
    if (keepFocus) this.editor.focus();
  }

  private renderInstr(p: Puzzle): void {
    const task = this.tasks[this.taskIndex];
    if (this.tasks.length > 1 && task?.label) {
      this.instrEl.textContent = `→ ${task.label}  ·  job ${this.taskIndex + 1}/${this.tasks.length}`;
    } else {
      this.instrEl.textContent = task?.label ?? p.blurb;
    }
  }

  private elapsed(): number {
    return this.startMs === null ? 0 : Date.now() - this.startMs;
  }

  private onKey(): void {
    if (this.done) return;
    if (this.startMs === null) {
      this.startMs = Date.now();
      this.tick = window.setInterval(() => this.renderHud(), 100);
    }
    this.keys++;
    this.renderHud();
  }

  private renderHud(): void {
    const best = loadBest(this.group.id);
    this.hudEl.innerHTML =
      `<span class="hud-item">time <b>${fmtMs(this.elapsed())}</b></span>` +
      `<span class="hud-item">keys <b>${this.keys}</b></span>` +
      (best ? `<span class="hud-item hud-dim">best ${fmtMs(best)}</span>` : "");
  }

  private renderBar(): void {
    const total = this.stages.length;
    this.barEl.innerHTML = blockBar(
      `Gauntlet · ${this.index}/${total}`,
      this.index,
      total,
    );
  }

  private onChange(state: EditorState): void {
    if (this.done) return;

    if (this.diffMode) {
      const b = nextBeacon(state.lines, this.diffTarget);
      if (b) {
        this.editor.setTargets([b]);
        return;
      }
      this.advanceStage();
      return;
    }

    const task = this.tasks[this.taskIndex];
    if (!task) return;
    if (!checkPuzzle(task.goal, state)) {
      // Once you start editing the beacon, clear it so the stale highlight
      // doesn't overlap the shifted text.
      if (state.lines.join("\n") !== this.taskStartBuf) this.editor.setTargets([]);
      return;
    }

    this.taskIndex++;
    if (this.taskIndex < this.tasks.length) {
      // Reveal the next beacon in this passage.
      this.editor.setTargets(this.tasks[this.taskIndex].targets ?? []);
      this.taskStartBuf = state.lines.join("\n");
      this.renderInstr(this.stages[this.index]);
      return;
    }

    this.advanceStage();
  }

  private advanceStage(): void {
    this.index++;
    this.renderBar();
    if (this.index < this.stages.length) {
      this.mountStage(this.index);
    } else {
      this.finish();
    }
  }

  private finish(): void {
    this.done = true;
    window.clearInterval(this.tick);
    const total = this.elapsed();
    const prevBest = loadBest(this.group.id);
    const isBest = prevBest === null || total < prevBest;
    if (isBest) saveBest(this.group.id, total);

    const masterTitle = `🥋 ${this.group.title} of meow`;
    const rank = gradeGauntlet(total, this.totalPar(), masterTitle);
    this.stageEl.textContent = "";
    this.instrEl.textContent = "";
    this.legendEl.innerHTML = "";
    this.targetHost.replaceChildren();
    this.editor.setTargets([]);
    this.renderHud();
    this.resultEl.className = `result result-show grade-${rank.grade}`;
    this.resultEl.innerHTML =
      `<div class="result-grade">${rank.grade}</div>` +
      `<div class="result-body">` +
      `<div class="result-line"><b>${escapeHtml(rank.title)}</b> — ${this.stages.length} passages in ${fmtMs(
        total,
      )} (${this.keys} keys).</div>` +
      `<div class="result-note">${
        isBest ? "New best time! " : `Best ${fmtMs(prevBest!)}. `
      }Restart for a fresh gauntlet.</div>` +
      `</div>`;
  }

  destroy(): void {
    window.clearInterval(this.tick);
  }
}
