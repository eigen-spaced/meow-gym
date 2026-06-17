import type { Puzzle } from "./puzzles";
import type { TargetSpan } from "../editor/EditorView";

const tspan = (
  row: number,
  c1: number,
  c2: number,
  cls?: string,
): TargetSpan => ({ start: { row, col: c1 }, end: { row, col: c2 }, ...(cls ? { cls } : {}) });
const tcell = (row: number, col: number, cls?: string): TargetSpan =>
  tspan(row, col, col + 1, cls);

// Procedural "fix the text" puzzles. Each call mutates a clean sentence with a
// random mix of typos / scrambles / extra / missing / wrong words, so no two
// rounds are the same. The clean sentence is always the target.

const CORPUS: string[] = [
  "the curious cat watched the blinking cursor",
  "soft paws padded across the warm keyboard",
  "a modal editor rewards patience and practice",
  "select the word then strike with a single key",
  "every motion leaves a tidy little selection",
  "the quick brown fox naps on the server rack",
  "good editors get out of your way completely",
  "meow turns editing into a calm quiet game",
  "press escape and the buffer returns to normal",
  "a sleepy kitten dreams of endless yarn balls",
  "fewer keystrokes means more thinking and less typing",
  "the cursor glides between brackets without effort",
];

const JUNK = [
  "very",
  "really",
  "just",
  "quite",
  "somehow",
  "totally",
  "basically",
  "actually",
  "literally",
  "honestly",
];

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

let counter = 0;
const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: T[]): T => a[rand(a.length)];

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// --- word-level mutations (return a changed word) -------------------------

function doubleLetter(w: string): string {
  const i = rand(w.length);
  return w.slice(0, i) + w[i] + w.slice(i);
}
function dropLetter(w: string): string {
  if (w.length < 3) return doubleLetter(w);
  const i = rand(w.length);
  return w.slice(0, i) + w.slice(i + 1);
}
function wrongLetter(w: string): string {
  const i = rand(w.length);
  let c = w[i];
  while (c === w[i]) c = pick(LETTERS.split(""));
  return w.slice(0, i) + c + w.slice(i + 1);
}
function typo(w: string): string {
  const fns = [doubleLetter, dropLetter, wrongLetter];
  let out = w;
  let tries = 0;
  while (out === w && tries < 12) {
    out = pick(fns)(w);
    tries++;
  }
  return out;
}
function scramble(w: string): string {
  if (w.length < 4) return typo(w);
  let out = w;
  let tries = 0;
  while (out === w && tries < 12) {
    out = shuffle(w.split("")).join("");
    tries++;
  }
  return out;
}

export function generateFixPuzzle(round: number): Puzzle {
  counter += 1;
  const clean = pick(CORPUS);
  const words = clean.split(" ");
  const buf = [...words];
  const cls = new Set<string>();
  let par = 2;

  // Two word defects on distinct words.
  for (const wi of shuffle(words.map((_, i) => i)).slice(0, 2)) {
    const kind = pick(["typo", "scramble", "wrong"]);
    buf[wi] =
      kind === "typo"
        ? typo(words[wi])
        : kind === "scramble"
          ? scramble(words[wi])
          : pick(JUNK);
    cls.add("t-fix");
    par += kind === "wrong" ? 4 + words[wi].length : 4;
  }

  // Sometimes an extra word to delete.
  if (rand(2) === 0) {
    buf.splice(rand(buf.length + 1), 0, pick(JUNK));
    cls.add("t-del");
    par += 5;
  }

  // Guarantee there's something to fix.
  if (buf.join(" ") === clean) {
    buf[0] = typo(words[0]);
    cls.add("t-fix");
    par += 4;
  }

  return {
    id: `fix-r${round}-${counter}`,
    title: "Fix the text",
    kind: "fix",
    diff: true,
    blurb:
      "Fix the highlighted word to match the target. Each fix reveals the next.",
    buffer: [buf.join(" ")],
    target: [clean],
    goal: { type: "text", target: [clean] },
    legendCls: [...cls],
    par,
  };
}

// --- gauntlet archetypes (one randomized puzzle per meow skill) ------------

const NAMES = [
  "calc",
  "render",
  "update",
  "parse",
  "handle",
  "format",
  "build",
  "fetch",
  "filter",
  "encode",
];
const ARGS = ["a + b", "x, y", "value", "total", "head", "n - 1", "items", "lhs"];
const VARS = ["old", "temp", "draft", "stub", "wip"];
const REPL = ["done", "next", "final", "fixed", "ready"];
const STRINGS = [
  "delete all of this",
  "remove me please",
  "temporary text",
  "scratch this",
  "placeholder",
];
const KEEP = [
  "keep this line",
  "this one stays",
  "leave me here",
  "important stuff",
  "do not touch",
];
const DROP = [
  "delete this row",
  "remove me now",
  "junk to cut",
  "useless line",
  "kill this one",
];

const BRACKETS: [string, string][] = [
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
];

export function generateDeleteBlockPuzzle(round: number): Puzzle {
  counter += 1;
  const name = pick(NAMES);
  const [o, c] = pick(BRACKETS);
  const inner = o + pick(ARGS) + c;
  const line = name + inner + ";";
  return {
    id: `g-del-${round}-${counter}`,
    title: "Delete the block",
    kind: "delete",
    blurb: `delete the ${o}${c} block and its contents`,
    buffer: [line],
    goal: { type: "text", target: [name + ";"] },
    targets: [tspan(0, name.length, name.length + inner.length, "t-del")],
    par: 2,
  };
}

export function generateEmptyStringPuzzle(round: number): Puzzle {
  counter += 1;
  const name = pick(NAMES);
  const s = pick(STRINGS);
  const innerStart = name.length + 2; // name + ( + "
  return {
    id: `g-str-${round}-${counter}`,
    title: "Empty the string",
    kind: "golf",
    blurb: "delete the text inside the quotes",
    buffer: [`${name}("${s}")`],
    target: [`${name}("")`],
    goal: { type: "text", target: [`${name}("")`] },
    targets: [tspan(0, innerStart, innerStart + s.length, "t-del")],
    par: 5,
  };
}

export function generateChangeArgPuzzle(round: number): Puzzle {
  counter += 1;
  const name = pick(NAMES);
  const oldv = pick(VARS);
  const neu = pick(REPL);
  const start = name.length + 1;
  return {
    id: `g-chg-${round}-${counter}`,
    title: "Change the argument",
    kind: "fix",
    blurb: `change the argument to ${neu}`,
    buffer: [`${name}(${oldv})`],
    target: [`${name}(${neu})`],
    goal: { type: "text", target: [`${name}(${neu})`] },
    targets: [tspan(0, start, start + oldv.length, "t-fix")],
    par: 4 + neu.length,
  };
}

export function generateNavigatePuzzle(round: number): Puzzle {
  counter += 1;
  const clean = pick(CORPUS);
  const words = clean.split(" ");
  const wi = 1 + rand(words.length - 1);
  const col = words.slice(0, wi).join(" ").length + 1; // first char of word wi
  return {
    id: `g-nav-${round}-${counter}`,
    title: "Navigate",
    kind: "navigate",
    blurb: "move the cursor onto the highlighted letter",
    buffer: [clean],
    goal: { type: "cursor", row: 0, col },
    targets: [tcell(0, col, "t-nav")],
    par: 3,
  };
}

export function generateKillLinePuzzle(round: number): Puzzle {
  counter += 1;
  const keepA = pick(KEEP);
  let keepB = pick(KEEP);
  while (keepB === keepA) keepB = pick(KEEP);
  const drop = pick(DROP);
  const pos = rand(3);
  const lines = [keepA, keepB];
  lines.splice(pos, 0, drop);
  return {
    id: `g-line-${round}-${counter}`,
    title: "Kill the line",
    kind: "delete",
    blurb: "delete the highlighted line",
    buffer: lines,
    goal: { type: "text", target: [keepA, keepB] },
    targets: [tspan(pos, 0, drop.length, "t-del")],
    par: 4,
  };
}

/**
 * Master Oogway: a compound but purely MECHANICAL puzzle. Several visible
 * defects in one buffer of plain sentences — typos/scrambles to fix, a junk word
 * or bracketed chunk to delete, maybe a whole junk line to kill — with the clean
 * text shown as the target. No domain reasoning: you only execute meow edits to
 * reach the given target.
 */
// Column of word index `wi` in a space-joined word list.
function colOfWord(words: string[], wi: number): number {
  return wi === 0 ? 0 : words.slice(0, wi).join(" ").length + 1;
}

// --- Oogway: a compound passage of mechanical defects (diff-driven) --------
// The buffer has several visible defects and the clean text is the target; the
// view derives the next beacon live from the diff, so jobs can be done in any
// order and a beacon never goes stale mid-edit.
export function generateOogwayPuzzle(round: number): Puzzle {
  counter += 1;
  const base = shuffle(CORPUS.map((_, i) => i))
    .slice(0, 4)
    .map((i) => CORPUS[i]);

  const structural = pick(["delLine", "dupLine"]);
  const dupIdx = structural === "dupLine" ? rand(base.length) : -1;

  // Target = clean base, with one line duplicated for the yank job.
  const target: string[] = [];
  base.forEach((t, i) => {
    target.push(t);
    if (i === dupIdx) target.push(t);
  });

  // Buffer = base with word defects baked in (and a junk line for delLine).
  const buf = [...base];
  const cls = new Set<string>();
  let par = 3;

  const candidates = base.map((_, i) => i).filter((i) => i !== dupIdx);
  for (const li of shuffle(candidates).slice(0, 2 + (rand(3) === 0 ? 1 : 0))) {
    const words = buf[li].split(" ");
    const kind = pick(["typo", "wrong", "extra", "chunk", "insert"]);
    if (kind === "typo") {
      const wi = rand(words.length);
      words[wi] = typo(words[wi]);
      cls.add("t-fix");
      par += 4;
    } else if (kind === "wrong") {
      const wi = rand(words.length);
      words[wi] = pick(JUNK);
      cls.add("t-fix");
      par += 4 + words[wi].length;
    } else if (kind === "extra") {
      words.splice(rand(words.length + 1), 0, pick(JUNK));
      cls.add("t-del");
      par += 5;
    } else if (kind === "chunk") {
      const [o, c] = pick(BRACKETS);
      words.splice(1 + rand(words.length - 1), 0, o + pick(JUNK) + c);
      cls.add("t-del");
      par += 4;
    } else {
      // insert: remove a (non-last) word so the player must add it back.
      words.splice(rand(Math.max(1, words.length - 1)), 1);
      cls.add("t-ins");
      par += 4;
    }
    buf[li] = words.join(" ");
  }

  if (structural === "dupLine") {
    cls.add("t-yank");
    par += 4;
  } else {
    buf.splice(rand(buf.length + 1), 0, pick(DROP));
    cls.add("t-del");
    par += 4;
  }

  return {
    id: `oogway-r${round}-${counter}`,
    title: "Clean the passage",
    kind: "fix",
    diff: true,
    blurb:
      "Several defects, marked one at a time as colored beacons. Clear them in any order to match the target.",
    buffer: buf,
    target,
    goal: { type: "text", target },
    legendCls: [...cls],
    par,
  };
}

// Lisp: nested parens everywhere. The trap is that o grabs the *innermost*
// pair enclosing the cursor — so you must get inside the right s-expression
// first. Each junk sub-expr sits between atoms, so removing it collapses cleanly.
// Junk is flanked by atoms (so removal collapses to a clean form) and its first
// inner char is a symbol (so o grabs the whole junk, not a deeper nested pair).
const LISP_FORMS: ((j: string) => { buf: string; clean: string })[] = [
  (j) => ({ buf: `(+ a ${j} b)`, clean: `(+ a b)` }),
  (j) => ({ buf: `(list x ${j} y)`, clean: `(list x y)` }),
  (j) => ({
    buf: `(defun area (r) (* pi ${j} r))`,
    clean: `(defun area (r) (* pi r))`,
  }),
  (j) => ({
    buf: `(let ((n 5)) (+ n ${j} n))`,
    clean: `(let ((n 5)) (+ n n))`,
  }),
  (j) => ({
    buf: `(if (> n 0) (+ n ${j} acc) lo)`,
    clean: `(if (> n 0) (+ n acc) lo)`,
  }),
];
const LISP_JUNK = [
  "(* 2 (+ 1 3))",
  "(or a (and b c))",
  "(when ok (run))",
  "(car (cdr lst))",
  "(min y (abs z))",
];

export function generateLispPuzzle(round: number): Puzzle {
  counter += 1;
  const j = pick(LISP_JUNK);
  const { buf, clean } = pick(LISP_FORMS)(j);
  const start = buf.indexOf(j);
  return {
    id: `g-lisp-${round}-${counter}`,
    title: "Lisp surgery",
    kind: "delete",
    blurb:
      "delete the highlighted s-expression — get the cursor inside it, then o grabs exactly that pair",
    buffer: [buf],
    target: [clean],
    goal: { type: "text", target: [clean] },
    targets: [tspan(0, start, start + j.length, "t-del")],
    par: 5,
  };
}

const GAUNTLET_GENS: ((round: number) => Puzzle)[] = [
  generateFixPuzzle,
  generateDeleteBlockPuzzle,
  generateEmptyStringPuzzle,
  generateChangeArgPuzzle,
  generateNavigatePuzzle,
  generateKillLinePuzzle,
  generateLispPuzzle,
];

/** One randomized puzzle drawn from every meow skill, for the gauntlet. */
export function generateGauntletPuzzle(round: number): Puzzle {
  return pick(GAUNTLET_GENS)(round);
}

// --- endless practice rounds (per group) ----------------------------------

/** A multi-target navigate tour: reach each highlighted letter in order. */
export function generateNavTourPuzzle(round: number): Puzzle {
  counter += 1;
  const lines = shuffle(CORPUS.map((_, i) => i))
    .slice(0, 3)
    .map((i) => CORPUS[i]);
  const tasks = lines.map((line, row) => {
    const words = line.split(" ");
    const wi = 1 + rand(words.length - 1);
    const col = colOfWord(words, wi);
    return {
      goal: { type: "cursor" as const, row, col },
      targets: [tcell(row, col, "t-nav")],
      label: `reach beacon ${row + 1}`,
    };
  });
  return {
    id: `g-tour-${round}-${counter}`,
    title: "The tour",
    kind: "navigate",
    blurb: "Reach each highlighted letter in order — fewest keys wins.",
    buffer: lines,
    goal: tasks[tasks.length - 1].goal,
    tasks,
    targets: tasks[0].targets,
    par: 3 * lines.length,
  };
}

export function generateNavRound(round: number): Puzzle {
  return rand(4) === 0
    ? generateNavTourPuzzle(round)
    : generateNavigatePuzzle(round);
}

export function generateDeleteRound(round: number): Puzzle {
  return pick([
    generateDeleteBlockPuzzle,
    generateLispPuzzle,
    generateEmptyStringPuzzle,
  ])(round);
}

export function generateGolfRound(round: number): Puzzle {
  return pick([
    generateChangeArgPuzzle,
    generateEmptyStringPuzzle,
    generateDeleteBlockPuzzle,
  ])(round);
}
