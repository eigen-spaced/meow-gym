import type { EditorState } from "../editor/types";
import type { TargetSpan } from "../editor/EditorView";
import { checkGoal, type Goal } from "../lessons/lessons";
import {
  generateFixPuzzle,
  generateGauntletPuzzle,
  generateOogwayPuzzle,
  generateNavRound,
  generateDeleteRound,
  generateGolfRound,
} from "./generate";

export type PuzzleKind = "fix" | "timed" | "golf" | "navigate" | "delete";

/** One step of a multi-task puzzle. */
export interface PuzzleTask {
  goal: Goal;
  targets?: TargetSpan[];
  /** Short label for the progress readout, e.g. "reach X". */
  label?: string;
}

export interface Puzzle {
  id: string;
  title: string;
  kind: PuzzleKind;
  /** One-line description of the challenge. */
  blurb: string;
  buffer: string[];
  /** Single-task goal. Ignored when `tasks` is provided. */
  goal: Goal;
  /** Multi-task puzzles: a sequence of sub-goals within one buffer. */
  tasks?: PuzzleTask[];
  /** The corrected text, shown as a target panel (fix/golf/timed only). */
  target?: string[];
  /** Goal regions highlighted in the buffer (navigate/delete, single-task). */
  targets?: TargetSpan[];
  /**
   * Diff mode: instead of scripted tasks, the beacon is derived live from the
   * diff between buffer and target. Used by multi-defect text puzzles (fix,
   * Oogway) so highlights are never stale and jobs can be done in any order.
   */
  diff?: boolean;
  /** Job colors to show in the legend (for diff puzzles). */
  legendCls?: string[];
  /** Reference keystroke count for an efficient meow solution. */
  par: number;
}

/** A themed sequence of puzzles; the progress bar fills as you clear each. */
export interface PuzzleGroup {
  id: string;
  title: string;
  blurb: string;
  /** Static puzzles. Empty for generated groups. */
  puzzles: Puzzle[];
  /** If set, the group generates fresh puzzles each round (endless). */
  generate?: (round: number) => Puzzle;
  /** How many generated puzzles make up one set (default 5). */
  rounds?: number;
  /** Timed gauntlet: one continuous clock across all rounds, total-time score. */
  gauntlet?: boolean;
  /** Sidebar icon override. */
  icon?: string;
}

/** Normalize a puzzle to its task list (single-goal puzzles → one task). */
export function tasksOf(p: Puzzle): PuzzleTask[] {
  return p.tasks ?? [{ goal: p.goal, targets: p.targets }];
}

// --- goal check -----------------------------------------------------------
// Text goals are whitespace-tolerant: killing a word or a block leaves stray
// spaces / blank lines, and we care about the surviving content, not the gaps.

function normalizeLoose(lines: string[]): string[] {
  const out = lines
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l !== "");
  return out.length ? out : [""];
}

export function checkPuzzle(goal: Goal, state: EditorState): boolean {
  if (goal.type === "text") {
    const a = normalizeLoose(state.lines);
    const b = normalizeLoose(goal.target);
    return a.length === b.length && a.every((l, i) => l === b[i]);
  }
  // cursor / contains goals (navigate puzzles) want exact matching.
  return checkGoal(goal, state);
}

// --- efficiency grading ---------------------------------------------------

export type Grade = "S" | "A" | "B" | "C";

export interface Score {
  keys: number;
  movementKeys: number;
  grade: Grade;
  note?: string;
}

export function gradeRun(par: number, keys: number, movementKeys: number): Score {
  const ratio = keys / par;
  let grade: Grade;
  if (ratio <= 1.05) grade = "S";
  else if (ratio <= 1.4) grade = "A";
  else if (ratio <= 2.2) grade = "B";
  else grade = "C";

  let note: string | undefined;
  if (keys > 0 && movementKeys / keys > 0.45) {
    note =
      "You leaned on h/j/k/l. Word motions (e/b), find (f/t), things (,/.) and block (o) get you there in far fewer keys.";
  } else if (grade === "S") {
    note = "Spotless — that's meow par or better.";
  } else if (grade === "A") {
    note = "Tight. A motion or two away from par.";
  }
  return { keys, movementKeys, grade, note };
}

// --- the groups -----------------------------------------------------------

export const GROUPS: PuzzleGroup[] = [
  {
    id: "fix",
    title: "Fix words & typos",
    blurb:
      "Repair broken sentences with select-then-act: reach a word, mark it (w), then change (c) or kill (s) it. Each round is freshly generated — keep going as long as you like.",
    puzzles: [],
    generate: generateFixPuzzle,
    rounds: 5,
  },
  {
    id: "navigate",
    title: "Navigate",
    blurb:
      "Move the cursor to the highlighted spot in as few keystrokes as you can. An hjkl crawl works but scores poorly — find (f) and word motions fly. Fresh every round.",
    puzzles: [],
    generate: generateNavRound,
    rounds: 5,
  },
  {
    id: "delete",
    title: "Delete blocks",
    blurb:
      "meow's home turf. o (meow-block) grabs the nearest bracket pair from wherever the cursor sits — then s kills it. Blocks, strings, nested lisp — fresh every round.",
    puzzles: [],
    generate: generateDeleteRound,
    rounds: 5,
  },
  {
    id: "golf",
    title: "Golf",
    blurb:
      "Fewest keystrokes wins. There's always a text-object or block move that beats marching character-by-character — find it. Fresh every round.",
    puzzles: [],
    generate: generateGolfRound,
    rounds: 5,
  },
  {
    id: "shifu",
    title: "Master Shifu",
    blurb:
      "Ten randomized puzzles spanning every meow skill — fixes, blocks, things, finds, lines, navigation — against one running clock. One problem each, fast and clean. No hints, no mercy. Solve them all in the least time.",
    puzzles: [],
    generate: generateGauntletPuzzle,
    rounds: 10,
    gauntlet: true,
    icon: "🥋",
  },
  {
    id: "oogway",
    title: "Master Oogway",
    blurb:
      "The final tier. Each round is a whole passage with several defects at once — chunks to delete, typos to fix — and one running clock across eight of them. Pure meow execution: the target is given, you just clean it. Prove you are the master oogway of meow.",
    puzzles: [],
    generate: generateOogwayPuzzle,
    rounds: 8,
    gauntlet: true,
    icon: "🐢",
  },
];

/** Flat list of every puzzle, for tooling / verification. */
export const PUZZLES: Puzzle[] = GROUPS.flatMap((g) => g.puzzles);
