// Scoring for the two puzzle modes: per-puzzle keystroke efficiency (gradeRun)
// and whole-gauntlet time (gradeGauntlet). Kept separate from puzzle data so
// the two scoring policies live side by side.

export type Grade = "S" | "A" | "B" | "C";

export interface Score {
  keys: number;
  movementKeys: number;
  grade: Grade;
  note?: string;
}

/** Grade a single puzzle on keystroke economy vs its par. */
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

export interface Rank {
  grade: Grade;
  title: string;
}

/** Grade a whole gauntlet on total time vs a brisk target pace (~0.35s/key). */
export function gradeGauntlet(
  totalMs: number,
  totalPar: number,
  masterTitle: string,
): Rank {
  const target = totalPar * 350;
  const r = totalMs / target;
  if (r <= 1.1) return { grade: "S", title: masterTitle };
  if (r <= 1.6) return { grade: "A", title: "Black belt" };
  if (r <= 2.4) return { grade: "B", title: "Getting there" };
  return { grade: "C", title: "Keep training" };
}
