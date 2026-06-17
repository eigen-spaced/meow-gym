import { PuzzleView } from "./PuzzleView";
import { blockBar } from "./progress";
import { escapeHtml } from "../app/html";
import type { Puzzle, PuzzleGroup } from "./puzzles";

export interface GroupViewCallbacks {
  /** Persist that a puzzle was solved (id), for cross-session progress. */
  onComplete: (id: string) => void;
}

/**
 * Renders a themed group of puzzles as a sequence: one progress bar for the
 * whole group, advancing as each puzzle inside is solved. Generated groups
 * never end — finishing a set rolls a fresh one.
 */
export class GroupView {
  readonly el: HTMLDivElement;
  private barEl!: HTMLDivElement;
  private stageInfoEl!: HTMLDivElement;
  private host!: HTMLDivElement;
  private active?: PuzzleView;
  private stageIndex = 0;
  private readonly generated: boolean;
  private stages: Puzzle[];
  /** Generated-group progress is per-session (ids are ephemeral). */
  private localSolved = new Set<string>();

  constructor(
    private group: PuzzleGroup,
    private completed: Set<string>,
    private cb: GroupViewCallbacks,
  ) {
    this.generated = !!group.generate;
    this.stages = this.buildStages();

    if (!this.generated) {
      const firstUnsolved = this.stages.findIndex((p) => !completed.has(p.id));
      this.stageIndex = firstUnsolved < 0 ? 0 : firstUnsolved;
    }

    this.el = document.createElement("div");
    this.el.className = "lesson";
    this.build();
  }

  private buildStages(): Puzzle[] {
    if (this.group.generate) {
      const rounds = this.group.rounds ?? 5;
      return Array.from({ length: rounds }, (_, i) => this.group.generate!(i));
    }
    return this.group.puzzles;
  }

  private isSolved(id: string): boolean {
    return this.generated ? this.localSolved.has(id) : this.completed.has(id);
  }

  private build(): void {
    const head = document.createElement("div");
    head.className = "lesson-head";
    head.innerHTML = `<h2>${escapeHtml(this.group.title)}</h2>`;

    const blurb = document.createElement("p");
    blurb.className = "prose";
    blurb.textContent = this.group.blurb;

    const progress = document.createElement("div");
    progress.className = "progress";
    this.barEl = progress;

    this.stageInfoEl = document.createElement("div");
    this.stageInfoEl.className = "stage-info";

    this.host = document.createElement("div");

    this.el.append(head, blurb, progress, this.stageInfoEl, this.host);
    this.renderBar();
    this.mountStage();
  }

  private renderBar(): void {
    const total = this.stages.length;
    const done = this.stages.filter((p) => this.isSolved(p.id)).length;
    const label = this.generated
      ? `This set · ${done}/${total}`
      : `Puzzles completed · ${done}/${total}`;
    this.barEl.innerHTML = blockBar(label, done, total);
  }

  private mountStage(): void {
    this.active?.destroy();
    const total = this.stages.length;
    const puzzle = this.stages[this.stageIndex];

    this.stageInfoEl.textContent = `Puzzle ${this.stageIndex + 1}/${total} · ${puzzle.title}`;

    const view = new PuzzleView(puzzle, {
      // Generated groups always have a next (the set rolls over endlessly).
      hasNext: this.generated || this.stageIndex < total - 1,
      onSolved: (id) => {
        if (this.generated) {
          this.localSolved.add(id);
        } else {
          this.completed.add(id);
          this.cb.onComplete(id);
        }
        this.renderBar();
      },
      onNext: () => this.advance(),
    });
    this.active = view;
    this.host.replaceChildren(view.el);
  }

  private advance(): void {
    const lastStage = this.stageIndex >= this.stages.length - 1;
    if (lastStage && this.generated) {
      // Roll a fresh set and keep going.
      this.stages = this.buildStages();
      this.stageIndex = 0;
      this.localSolved.clear();
      this.renderBar();
      this.mountStage();
    } else if (!lastStage) {
      this.stageIndex += 1;
      this.mountStage();
    } else {
      this.stageInfoEl.textContent = `✓ ${this.group.title} complete — every puzzle cleared.`;
      this.active?.destroy();
      this.host.replaceChildren();
    }
  }

  destroy(): void {
    this.active?.destroy();
  }
}