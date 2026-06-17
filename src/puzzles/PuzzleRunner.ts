import type { EditorState, TargetSpan } from "../editor/types";
import { checkPuzzle, tasksOf, type Puzzle, type PuzzleTask } from "./puzzles";
import { nextBeacon } from "./diff";

/**
 * Headless editing-progress logic for one puzzle, shared by PuzzleView and
 * GauntletView so the diff-vs-task state machine lives in one place.
 *
 * Two modes:
 *  - diff puzzles (fix/Oogway): the beacon is the live diff to the target;
 *    solved when there's no difference left.
 *  - task puzzles (navigate/delete/golf …): a sequence of sub-goals; the beacon
 *    is the current task's highlight, cleared once you start editing it (so a
 *    stale highlight never overlaps shifted text); solved when all tasks pass.
 */
export class PuzzleRunner {
  private tasks: PuzzleTask[];
  private taskIndex = 0;
  private readonly diffMode: boolean;
  private readonly diffTarget: string[];
  private readonly initialBuffer: string[];
  private taskStartBuf: string;

  constructor(private puzzle: Puzzle) {
    this.tasks = tasksOf(puzzle);
    this.diffMode = !!puzzle.diff;
    this.diffTarget = puzzle.target ?? [];
    this.initialBuffer = puzzle.buffer;
    this.taskStartBuf = puzzle.buffer.join("\n");
  }

  reset(): void {
    this.taskIndex = 0;
    this.taskStartBuf = this.initialBuffer.join("\n");
  }

  /** Beacon(s) to show for the initial, unedited buffer. */
  initialTargets(): TargetSpan[] {
    if (this.diffMode) {
      const b = nextBeacon(this.initialBuffer, this.diffTarget);
      return b ? [b] : [];
    }
    return this.tasks[0]?.targets ?? [];
  }

  /** Process a buffer change: the beacon(s) to show now + whether it's solved. */
  step(state: EditorState): { targets: TargetSpan[]; solved: boolean } {
    if (this.diffMode) {
      const b = nextBeacon(state.lines, this.diffTarget);
      return { targets: b ? [b] : [], solved: !b };
    }
    while (
      this.taskIndex < this.tasks.length &&
      checkPuzzle(this.tasks[this.taskIndex].goal, state)
    ) {
      this.taskIndex++;
      this.taskStartBuf = state.lines.join("\n");
    }
    if (this.taskIndex >= this.tasks.length) return { targets: [], solved: true };
    if (state.lines.join("\n") !== this.taskStartBuf) {
      return { targets: [], solved: false }; // mid-edit: clear the stale beacon
    }
    return { targets: this.tasks[this.taskIndex].targets ?? [], solved: false };
  }

  // --- readouts for the views (legend, "job k/n" instruction) ---

  get multiTask(): boolean {
    return !this.diffMode && this.tasks.length > 1;
  }
  get jobIndex(): number {
    return this.taskIndex;
  }
  get jobCount(): number {
    return this.tasks.length;
  }
  get jobLabel(): string | undefined {
    return this.tasks[this.taskIndex]?.label;
  }

  /** Job colors present in this puzzle, for the legend. */
  legendCls(): string[] {
    if (this.diffMode) return this.puzzle.legendCls ?? [];
    const cls = new Set<string>();
    for (const t of this.tasks) {
      for (const tg of t.targets ?? []) if (tg.cls) cls.add(tg.cls);
    }
    return [...cls];
  }
}
