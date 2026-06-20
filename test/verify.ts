// Drives each lesson through the engine with an intended solution and asserts
// the goal is reached. Run: npm run verify
import { MeowEngine } from "../src/editor/meow";
import { LESSONS, isPractice, checkGoal } from "../src/lessons/lessons";
import { PUZZLES, checkPuzzle, tasksOf } from "../src/puzzles/puzzles";
import {
  generateFixPuzzle,
  generateGauntletPuzzle,
  generateDeleteBlockPuzzle,
  generateEmptyStringPuzzle,
  generateChangeArgPuzzle,
  generateNavigatePuzzle,
  generateKillLinePuzzle,
  generateLispPuzzle,
  generateOogwayPuzzle,
  generateNavRound,
} from "../src/puzzles/generate";
import { nextBeacon, applyToward } from "../src/puzzles/diff";

// Split a solution string into key tokens. Lowercase/uppercase letters and
// punctuation are single keys; <Esc>, <CR>, <BS> are the special keys.
function tokens(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "<") {
      const end = s.indexOf(">", i);
      const name = s.slice(i + 1, end);
      out.push(
        name === "Esc"
          ? "Escape"
          : name === "CR"
            ? "Enter"
            : name === "BS"
              ? "Backspace"
              : name,
      );
      i = end;
    } else {
      out.push(s[i]);
    }
  }
  return out;
}

// One intended solution per lesson id.
const SOLUTIONS: Record<string, string> = {
  modes: "imeow<Esc>",
  move: "jjllll",
  "delete-char": "ld",
  append: "Aviolets are blue<Esc>",
  "word-kill": "egegegegege s".replace(/ /g, ""), // walk by word, then kill garbage
  "line-kill": "jxs",
  symbols: "llllllllllllllllllllWs", // 20 × l, then W, s
  extend: "wees",
  change: "llllwcdog<Esc>",
  yank: "xyp",
  replace: "fdwyfcwr",
  find: "f,s",
  things: "lllll,rcnew<Esc>",
  expand: "x3s",
};

let pass = 0;
let fail = 0;

for (const lesson of LESSONS) {
  if (!isPractice(lesson)) continue; // prose-only pages have no goal to solve
  const sol = SOLUTIONS[lesson.id];
  if (sol === undefined) {
    console.log(`?  ${lesson.id}: no solution defined`);
    fail++;
    continue;
  }
  const engine = new MeowEngine(lesson.buffer!);
  for (const key of tokens(sol)) {
    const shift = key.length === 1 && key !== key.toLowerCase();
    engine.feed(key, shift);
  }
  const ok = checkGoal(lesson.goal!, engine.state);
  if (ok) {
    pass++;
    console.log(`✓  ${lesson.id}`);
  } else {
    fail++;
    console.log(`✗  ${lesson.id}`);
    console.log(`   want: ${JSON.stringify(lesson.goal)}`);
    console.log(`   got buffer: ${JSON.stringify(engine.state.lines)}`);
    console.log(
      `   cursor: r${engine.state.active.row} c${engine.state.active.col}`,
    );
  }
}

// --- puzzles --------------------------------------------------------------

const PUZZLE_SOLUTIONS: Record<string, string> = {
  typos: "fuwcquick<Esc>fvwcover<Esc>",
  "extra-words": "frwsfwwsffws",
  mixed: "fuwcquick<Esc>flwcjumped<Esc>fsws",
  "golf-trim": 'f",gs',
  "golf-args": "f(,rcdone<Esc>",
  "nav-char": "jjjfxh",
  "nav-array": "f3h",
  "del-args": "os",
  "del-block": "os",
  "del-lisp": "fbos",
  "nav-tour": "fXhjjh",
};

console.log("\n-- puzzles --");
for (const puzzle of PUZZLES) {
  const sol = PUZZLE_SOLUTIONS[puzzle.id];
  if (sol === undefined) {
    console.log(`?  ${puzzle.id}: no solution defined`);
    fail++;
    continue;
  }
  const engine = new MeowEngine(puzzle.buffer);
  const keys = tokens(sol);
  const tasks = tasksOf(puzzle);
  let ti = 0;
  for (const key of keys) {
    const shift = key.length === 1 && key !== key.toLowerCase();
    engine.feed(key, shift);
    while (ti < tasks.length && checkPuzzle(tasks[ti].goal, engine.state)) ti++;
  }
  const ok = ti >= tasks.length;
  if (ok) {
    pass++;
    const tag = tasks.length > 1 ? `, ${tasks.length} tasks` : "";
    console.log(
      `✓  ${puzzle.id}  (solution: ${keys.length} keys, par ${puzzle.par}${tag})`,
    );
  } else {
    fail++;
    console.log(`✗  ${puzzle.id}  (reached ${ti}/${tasks.length} tasks)`);
    console.log(`   got:  ${JSON.stringify(engine.state.lines)}`);
    console.log(
      `   cursor: r${engine.state.active.row} c${engine.state.active.col}`,
    );
  }
}

// --- engine regression checks --------------------------------------------

console.log("\n-- engine --");
{
  // Repeated w must re-mark the same word, not walk forward (meow behaviour).
  const e = new MeowEngine(["foo bar baz"]);
  e.feed("w");
  e.feed("w");
  e.feed("w");
  const ok =
    e.state.anchor.row === 0 &&
    e.state.anchor.col === 0 &&
    e.state.active.row === 0 &&
    e.state.active.col === 3;
  if (ok) {
    pass++;
    console.log("✓  repeated w stays on the same word");
  } else {
    fail++;
    console.log(
      `✗  repeated w walked: anchor ${JSON.stringify(
        e.state.anchor,
      )} active ${JSON.stringify(e.state.active)}`,
    );
  }
}

// Diff-driven puzzles: there must be something to fix, every live beacon must be
// in-bounds, and following the beacons must converge to the target.
function diffOK(p: any): boolean {
  if (p.par <= 0 || !p.target) return false;
  const tgt: string[] = p.target;
  let buf: string[] = p.buffer;
  if (nextBeacon(buf, tgt) === null) return false; // nothing to do
  for (let s = 0; s < 300; s++) {
    const b = nextBeacon(buf, tgt);
    if (!b) return true; // converged
    if (b.start.row < 0 || b.start.row >= buf.length) return false;
    if (b.start.col < 0 || b.start.col >= b.end.col) return false;
    if (b.end.col > Math.max(1, buf[b.start.row].length)) return false;
    buf = applyToward(buf, tgt);
  }
  return false;
}

{
  let bad = 0;
  for (let i = 0; i < 200; i++) if (!diffOK(generateFixPuzzle(i % 5))) bad++;
  if (bad === 0) {
    pass++;
    console.log("✓  200 fix puzzles: live beacons in-bounds, converge to target");
  } else {
    fail++;
    console.log(`✗  ${bad}/200 fix puzzles malformed`);
  }
}

// Gauntlet puzzles span several goal kinds; each must be well-formed: there's
// something to do (text differs, or cursor goal isn't the start), par positive.
{
  let bad = 0;
  for (let i = 0; i < 300; i++) {
    const p = generateGauntletPuzzle(i % 10);
    if (p.par <= 0) bad++;
    else if (p.goal.type === "text") {
      const buf = p.buffer.join("\n");
      const tgt = p.goal.target.join("\n");
      if (buf === tgt) bad++;
    } else if (p.goal.type === "cursor") {
      if (p.goal.row === 0 && p.goal.col === 0) bad++;
    }
  }
  if (bad === 0) {
    pass++;
    console.log("✓  300 generated gauntlet puzzles are well-formed");
  } else {
    fail++;
    console.log(`✗  ${bad}/300 generated gauntlet puzzles malformed`);
  }
}

// Each gauntlet archetype must be solvable with real meow keystrokes.
console.log("\n-- gauntlet archetypes --");
function solveCheck(
  label: string,
  gen: (r: number) => any,
  solveFor: (p: any) => string,
): void {
  let bad = 0;
  for (let i = 0; i < 40; i++) {
    const p = gen(i);
    const e = new MeowEngine(p.buffer);
    for (const k of tokens(solveFor(p))) {
      const shift = k.length === 1 && k !== k.toLowerCase();
      e.feed(k, shift);
    }
    if (!checkPuzzle(p.goal, e.state)) bad++;
  }
  if (bad === 0) {
    pass++;
    console.log(`✓  ${label} (40 solved)`);
  } else {
    fail++;
    console.log(`✗  ${label}: ${bad}/40 unsolved`);
  }
}

solveCheck("delete-block", generateDeleteBlockPuzzle, () => "os");
solveCheck("empty-string", generateEmptyStringPuzzle, () => 'f",gs');
solveCheck("change-arg", generateChangeArgPuzzle, (p) => {
  const buf: string = p.buffer[0];
  const start = buf.indexOf("(") + 1;
  const tgt: string = p.target[0];
  const neu = tgt.slice(tgt.indexOf("(") + 1, tgt.indexOf(")"));
  return "l".repeat(start) + "wc" + neu + "<Esc>";
});
solveCheck("navigate", generateNavigatePuzzle, (p) => "l".repeat(p.goal.col));
solveCheck("kill-line", generateKillLinePuzzle, (p) => {
  const row = p.targets[0].start.row;
  return "j".repeat(row) + "xs";
});
solveCheck("lisp-surgery", generateLispPuzzle, (p) => {
  // Step just inside the highlighted s-expression, then o (innermost), s.
  const inside = p.targets[0].start.col + 1;
  return "l".repeat(inside) + "os";
});

// Navigate rounds (single reach + the multi-target tour): reach every cursor
// goal by resetting to top-left then moving precisely.
{
  let bad = 0;
  for (let i = 0; i < 120; i++) {
    const p: any = generateNavRound(i % 5);
    const e = new MeowEngine(p.buffer);
    const tasks = tasksOf(p);
    let ti = 0;
    for (const t of tasks) {
      for (let k = 0; k < 20; k++) e.feed("k");
      for (let k = 0; k < 80; k++) e.feed("h");
      for (let k = 0; k < t.goal.row; k++) e.feed("j");
      for (let k = 0; k < t.goal.col; k++) e.feed("l");
      if (checkPuzzle(t.goal, e.state)) ti++;
      else break;
    }
    if (ti !== tasks.length) bad++;
  }
  if (bad === 0) {
    pass++;
    console.log("✓  navigate rounds (incl. tours) reachable");
  } else {
    fail++;
    console.log(`✗  ${bad}/120 navigate rounds unreachable`);
  }
}

// Oogway compound puzzles: diff-driven, must converge.
{
  let bad = 0;
  for (let i = 0; i < 300; i++) if (!diffOK(generateOogwayPuzzle(i % 8))) bad++;
  if (bad === 0) {
    pass++;
    console.log("✓  300 Oogway puzzles: live beacons in-bounds, converge to target");
  } else {
    fail++;
    console.log(`✗  ${bad}/300 Oogway puzzles malformed`);
  }
}

// nextBeacon classification unit tests.
{
  const cases: [string[], string[], string][] = [
    [["the cat sat"], ["the dog sat"], "t-fix"],
    [["the big cat sat"], ["the cat sat"], "t-del"],
    [["the sat"], ["the cat sat"], "t-ins"],
    [["a", "junk", "b"], ["a", "b"], "t-del"],
    [["a", "b"], ["a", "a", "b"], "t-yank"],
    // a line with a word defect must align to its target line, not collide:
    [["press basically escape now"], ["press escape now"], "t-del"],
    // dup + word defects across lines: the missing duplicate comes first.
    [
      ["one two three", "meow turns editing", "press junk escape here", "a b c d"],
      [
        "one two three",
        "meow turns editing",
        "meow turns editing",
        "press escape here",
        "a b c d",
      ],
      "t-yank",
    ],
  ];
  let bad = 0;
  for (const [buf, tgt, want] of cases) {
    const b = nextBeacon(buf, tgt);
    if (!b || b.cls !== want) {
      bad++;
      console.log(`   beacon: ${JSON.stringify(buf)} -> got ${b?.cls}, want ${want}`);
    }
  }
  if (nextBeacon(["x y"], ["x y"]) !== null) bad++;
  if (bad === 0) {
    pass++;
    console.log("✓  nextBeacon classifies fix/del/ins/dup and detects done");
  } else {
    fail++;
    console.log(`✗  nextBeacon classification: ${bad} wrong`);
  }
}

// Contiguous diffs group into ONE beacon (so you select+act once).
{
  let bad = 0;
  // "really quite" -> "the": one t-fix spanning both words (cols 2..14).
  const f = nextBeacon(["a really quite b"], ["a the b"]);
  if (!f || f.cls !== "t-fix" || f.start.col !== 2 || f.end.col !== 14) bad++;
  // two adjacent extra words -> one t-del spanning both (cols 2..9).
  const d = nextBeacon(["a foo bar b"], ["a b"]);
  if (!d || d.cls !== "t-del" || d.start.col !== 2 || d.end.col !== 9) bad++;
  if (bad === 0) {
    pass++;
    console.log("✓  adjacent diffs group into a single beacon");
  } else {
    fail++;
    console.log(`✗  beacon grouping: ${bad} wrong`);
  }
}

// e/b move word-by-word (non-expandable); only w makes them extend.
{
  const sel = (e: MeowEngine) => {
    const r = e.selectionRange();
    return r ? e.state.lines[0].slice(r.start.col, r.end.col) : "";
  };
  // bare e e moves to the 2nd word (does NOT accumulate)
  const a = new MeowEngine(["alpha beta gamma"]);
  a.feed("e");
  a.feed("e");
  const moved = sel(a) === "beta";
  // w then e extends across both words
  const b = new MeowEngine(["alpha beta gamma"]);
  b.feed("w");
  b.feed("e");
  const extended = sel(b) === "alpha beta";
  if (moved && extended) {
    pass++;
    console.log("✓  e/b move word-by-word; w then e extends");
  } else {
    fail++;
    console.log(`✗  e-behavior: moved=${moved} (${sel(a)}) extended=${extended} (${sel(b)})`);
  }
}

// meow-replace (r): overwrite a selection with the kill-ring, not saving the
// replaced text.
{
  const e = new MeowEngine(["copy dog onto cat"]);
  for (const k of tokens("fdwyfcwr")) {
    const shift = k.length === 1 && k !== k.toLowerCase();
    e.feed(k, shift);
  }
  if (e.state.lines[0] === "copy dog onto dog") {
    pass++;
    console.log("✓  r replaces the selection with the kill-ring");
  } else {
    fail++;
    console.log(`✗  replace: got ${JSON.stringify(e.state.lines)}`);
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
