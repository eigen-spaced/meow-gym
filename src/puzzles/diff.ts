import type { TargetSpan } from "../editor/types";

// Live beacon: the first remaining difference between the buffer and the target,
// classified into a colored job. Because it's recomputed from the current
// buffer every keystroke, it (a) always points at the next thing to do while any
// difference remains, and (b) doesn't care what order you fix things in.

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

type EditType = "sub" | "del" | "ins";
interface Edit {
  type: EditType;
  bi: number;
  ti: number;
}

/** First edit (LCS-based) turning sequence `b` into `t`. */
function firstEdit(b: string[], t: string[]): Edit | null {
  const n = b.length;
  const m = t.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        b[i] === t[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (b[i] === t[j]) {
      i++;
      j++;
      continue;
    }
    const sub = dp[i + 1][j + 1];
    const del = dp[i + 1][j];
    const ins = dp[i][j + 1];
    if (sub >= del && sub >= ins) return { type: "sub", bi: i, ti: j };
    if (del >= ins) return { type: "del", bi: i, ti: j };
    return { type: "ins", bi: i, ti: j };
  }
  if (i < n) return { type: "del", bi: i, ti: j };
  if (j < m) return { type: "ins", bi: i, ti: j };
  return null;
}

/** Do two lines share more than half their words? (fuzzy line alignment) */
function similar(a: string, b: string): boolean {
  const aw = norm(a).split(" ").filter(Boolean);
  const bw = norm(b).split(" ").filter(Boolean);
  if (!aw.length || !bw.length) return false;
  const counts = new Map<string, number>();
  for (const w of bw) counts.set(w, (counts.get(w) ?? 0) + 1);
  let common = 0;
  for (const w of aw) {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      common++;
      counts.set(w, c - 1);
    }
  }
  return common / Math.max(aw.length, bw.length) >= 0.5;
}

/**
 * First line-level edit, aligning lines by similarity (not exact equality) so a
 * line with a word defect still pairs with its intended target line (returned as
 * a "sub" to be word-diffed) rather than colliding with an unrelated line.
 */
function lineEdit(buffer: string[], target: string[]): Edit | null {
  const B = buffer.map(norm);
  const T = target.map(norm);
  const n = B.length;
  const m = T.length;
  const eq = (i: number, j: number) =>
    B[i] === T[j] || similar(buffer[i], target[j]);
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(i, j)
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(i, j)) {
      if (B[i] !== T[j]) return { type: "sub", bi: i, ti: j }; // aligned, word-diff
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      return { type: "del", bi: i, ti: j };
    } else {
      return { type: "ins", bi: i, ti: j };
    }
  }
  if (i < n) return { type: "del", bi: i, ti: j };
  if (j < m) return { type: "ins", bi: i, ti: j };
  return null;
}

interface WordRegion {
  startI: number; // first buffer token in the region
  bufCount: number; // buffer tokens spanned
  tgtCount: number; // target tokens it should become
}

/**
 * The first CONTIGUOUS run of differing words between two token lists. Grouping
 * adjacent diffs into one beacon lets the player select the whole run and act
 * once (the point of modal editing) instead of one word at a time.
 */
function firstWordRegion(b: string[], t: string[]): WordRegion | null {
  const n = b.length;
  const m = t.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        b[i] === t[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m && b[i] === t[j]) {
    i++;
    j++;
  }
  if (i >= n && j >= m) return null;
  const startI = i; // leading matches advance both, so startJ === startI
  const startJ = j;
  while (i < n || j < m) {
    if (i < n && j < m && b[i] === t[j]) break; // re-synced
    if (i < n && j < m) {
      const sub = dp[i + 1][j + 1];
      const del = dp[i + 1][j];
      const ins = dp[i][j + 1];
      if (sub >= del && sub >= ins) {
        i++;
        j++;
      } else if (del >= ins) i++;
      else j++;
    } else if (i < n) i++;
    else j++;
  }
  return { startI, bufCount: i - startI, tgtCount: j - startJ };
}

/** Non-empty whitespace-separated tokens of a line, with their real columns. */
function tokens(line: string): { text: string; col: number }[] {
  const out: { text: string; col: number }[] = [];
  let col = 0;
  for (const part of line.split(" ")) {
    if (part !== "") out.push({ text: part, col });
    col += part.length + 1;
  }
  return out;
}

export function nextBeacon(
  buffer: string[],
  target: string[],
): TargetSpan | null {
  const B = buffer.map(norm);
  const T = target.map(norm);
  const le = lineEdit(buffer, target);
  if (!le) return null; // buffer matches the target

  if (le.type === "del") {
    // A whole buffer line that shouldn't be there.
    const w = Math.max(1, buffer[le.bi].length);
    return { start: { row: le.bi, col: 0 }, end: { row: le.bi, col: w }, cls: "t-del" };
  }

  if (le.type === "ins") {
    // The target has a line the buffer lacks. If it repeats the line above, it's
    // a duplicate to make (yank); otherwise it's a line to insert.
    if (le.bi - 1 >= 0 && B[le.bi - 1] === T[le.ti]) {
      const row = le.bi - 1;
      const w = Math.max(1, buffer[row].length);
      return { start: { row, col: 0 }, end: { row, col: w }, cls: "t-yank" };
    }
    const row = Math.min(le.bi, buffer.length - 1);
    return { start: { row, col: 0 }, end: { row, col: 1 }, cls: "t-ins" };
  }

  // Lines differ at the word level — find the first contiguous run of diffs and
  // highlight all of it as one beacon.
  const row = le.bi;
  const bt = tokens(buffer[row]);
  const r = firstWordRegion(
    bt.map((x) => x.text),
    tokens(target[le.ti]).map((x) => x.text),
  );
  if (!r) return null; // only whitespace differs; treat as done

  if (r.bufCount === 0) {
    // Pure insertion: a marker where the missing word(s) go.
    const lineLen = buffer[row].length;
    const col =
      r.startI < bt.length ? bt[r.startI].col : Math.max(0, lineLen - 1);
    return { start: { row, col }, end: { row, col: col + 1 }, cls: "t-ins" };
  }

  const first = bt[r.startI];
  const last = bt[r.startI + r.bufCount - 1];
  // buffer words that map to target words → change them; otherwise → delete.
  const cls = r.tgtCount > 0 ? "t-fix" : "t-del";
  return {
    start: { row, col: first.col },
    end: { row, col: last.col + last.text.length },
    cls,
  };
}

/** Apply one edit toward the target (used to prove beacons converge). */
export function applyToward(buffer: string[], target: string[]): string[] {
  const B = buffer.map(norm);
  const T = target.map(norm);
  const le = lineEdit(buffer, target);
  if (!le) return buffer;
  const out = [...buffer];
  if (le.type === "del") {
    out.splice(le.bi, 1);
    return out;
  }
  if (le.type === "ins") {
    if (le.bi - 1 >= 0 && B[le.bi - 1] === T[le.ti]) {
      out.splice(le.bi, 0, buffer[le.bi - 1]);
    } else {
      out.splice(Math.min(le.bi, out.length), 0, target[le.ti]);
    }
    return out;
  }
  const bt = tokens(buffer[le.bi]).map((x) => x.text);
  const tt = tokens(target[le.ti]).map((x) => x.text);
  const we = firstEdit(bt, tt);
  if (we) {
    if (we.type === "del") bt.splice(we.bi, 1);
    else if (we.type === "ins") bt.splice(we.bi, 0, tt[we.ti]);
    else bt[we.bi] = tt[we.ti];
  }
  out[le.bi] = bt.join(" ");
  return out;
}
