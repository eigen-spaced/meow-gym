import type { EditorState } from "./types";

// The goal model shared by lessons and puzzles: a small predicate over the
// editor state. Lives in the editor layer (next to EditorState), not in either
// feature folder, so neither depends sideways on the other.

export type Goal =
  | { type: "text"; target: string[] }
  | { type: "cursor"; row: number; col: number }
  | { type: "contains"; text: string };

function normalize(lines: string[]): string[] {
  const trimmed = lines.map((l) => l.trim());
  while (trimmed.length > 1 && trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  return trimmed;
}

export function checkGoal(goal: Goal, state: EditorState): boolean {
  switch (goal.type) {
    case "text": {
      const a = normalize(state.lines);
      const b = normalize(goal.target);
      return a.length === b.length && a.every((l, i) => l === b[i]);
    }
    case "cursor":
      return state.active.row === goal.row && state.active.col === goal.col;
    case "contains":
      return state.lines.join("\n").includes(goal.text);
  }
}
