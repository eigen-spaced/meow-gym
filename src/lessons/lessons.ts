import { checkGoal, type Goal } from "../editor/goals";

export { checkGoal, type Goal };

export interface KeyRef {
  key: string;
  desc: string;
}

export interface Lesson {
  id: string;
  title: string;
  /** Short intro paragraphs. Supports `code`, **bold**, links, and "- " bullets. */
  intro: string;
  /**
   * Page kind. "practice" (default) has a live editor + goal to clear; "info"
   * is a prose-only page (the welcome intro and the graduation page).
   */
  kind?: "practice" | "info";
  /** Extra prose shown after `intro` on "info" pages. Same markup subset. */
  body?: string;
  /** A note aimed squarely at recovering vimmers. */
  vimNote?: string;
  /** Practice fields — present on "practice" lessons, omitted on "info" pages. */
  keys?: KeyRef[];
  buffer?: string[];
  goal?: Goal;
  /** Plain-language description of the objective. */
  goalText?: string;
}

/** True for hands-on lessons (the ones that count toward progress). */
export const isPractice = (l: Lesson): boolean => l.kind !== "info";

// --- the curriculum -------------------------------------------------------
// Ordered in thematic blocks: basics → insert → delete a char → selection
// (build & refine) → acting on a selection (change/copy/replace) → advanced
// motions & objects.

export const LESSONS: Lesson[] = [
  // --- 0 · welcome (prose-only intro) ---
  {
    id: "welcome",
    kind: "info",
    title: "0 · Welcome",
    intro:
      "**meow gym** is a hands-on practice ground for [meow](https://github.com/meow-edit/meow), the modal editing system for **Emacs**. You drill its keys in a real little editor — no setup, no Emacs required — and watch the buffer change as you go.\n\nmeow's big idea is **selection-first** editing: you select a region (a word, a line, a thing between brackets) and *then* act on it. There are no operators to memorise — what you see selected is exactly what gets changed.",
    body:
      "Each lesson gives you a buffer, a goal, and the handful of keys you need. Clear the goal and move on. When you've finished the lessons, head to the **Gym** to drill what you've learned against timed, generated challenges.\n\n**Designed for vimmers — open to everyone.** If you're coming from vim, the lessons call out every key where your muscle memory will misfire (the orange *for vimmers* notes), and the editor pops up a gentle nudge when you hit a vim habit.\n\nNot a vim user? You can ignore all of that. Flip **vim hints** off in the top bar and the nudges disappear — the lessons still work perfectly on their own.\n\nLinks to learn more:\n- [meow on GitHub](https://github.com/meow-edit/meow) — the project, install instructions, and full docs\n- [meow's cheatsheet & concepts](https://github.com/meow-edit/meow/blob/master/CHEATSHEET.org)\n\nReady? Start with lesson 1.",
  },

  // --- basics ---
  {
    id: "modes",
    title: "1 · Modes & typing",
    intro:
      "meow, like vim, is **modal**. You start in **Normal** mode where keys are commands, not text. To actually type, enter **Insert** mode with `i`, and leave it with `Escape`.\n\nThe block cursor means Normal mode; a thin bar means Insert mode.",
    vimNote:
      "Good news: `i` and `Escape` work just like vim. This part is free.",
    keys: [
      { key: "i", desc: "enter Insert mode" },
      { key: "Esc", desc: "back to Normal mode" },
    ],
    buffer: [""],
    goal: { type: "contains", text: "meow" },
    goalText: "Press i, type the word meow, then press Escape.",
  },
  {
    id: "move",
    title: "2 · Moving around",
    intro:
      "Movement is the one place meow keeps vim's `h j k l`. Left, down, up, right.\n\nThere's a block cursor sitting at the top-left. Walk it onto the `X`.",
    vimNote: "Muscle memory intact — `h j k l` are identical to vim.",
    keys: [
      { key: "h", desc: "left" },
      { key: "j", desc: "down" },
      { key: "k", desc: "up" },
      { key: "l", desc: "right" },
    ],
    buffer: ["start here", "", "    X here is the target", ""],
    goal: { type: "cursor", row: 2, col: 4 },
    goalText: "Move the cursor so the block sits on the X (row 3, column 5).",
  },

  // --- insert, then delete a character ---
  {
    id: "append",
    title: "3 · Inserting in more places",
    intro:
      "Insert mode has several doors:\n- `i` insert at the cursor / start of selection\n- `a` append after the cursor / end of selection\n- `I` open a new line **above**\n- `A` open a new line **below**\n\nAdd a second line beneath the first.",
    vimNote:
      "Careful: in vim `o` opens a line below. In meow that's `A` (and `o` selects a block!). `I`/`A` are not line-start/line-end here.",
    keys: [
      { key: "A", desc: "open line below + insert" },
      { key: "I", desc: "open line above + insert" },
      { key: "a", desc: "append after cursor" },
    ],
    buffer: ["roses are red"],
    goal: { type: "text", target: ["roses are red", "violets are blue"] },
    goalText: 'Use A to add a line below, then type "violets are blue".',
  },
  {
    id: "delete-char",
    title: "4 · Deleting a character",
    intro:
      "With nothing selected, `d` deletes the single character under the cursor.\n\nThe word below has a typo — an extra letter. Land on it and delete it.",
    vimNote:
      "In vim you'd press `x` to delete a char. Try `x` here and watch what meow does instead — then use `d`.",
    keys: [
      { key: "d", desc: "delete char under cursor (no selection)" },
      { key: "h j k l", desc: "move" },
    ],
    buffer: ["meeow makes a great editor"],
    goal: { type: "text", target: ["meow makes a great editor"] },
    goalText: 'Turn "meeow" into "meow" by deleting the extra e.',
  },

  // --- selection: build & refine ---
  {
    id: "word-kill",
    title: "5 · Select a word, then kill it",
    intro:
      "This is the meow mindset: **select first, then act**. `w` selects (marks) the whole word under the cursor. Then `s` kills it — meow's word for cut.\n\nThere's a junk word at the end of the line. Get rid of it.",
    vimNote:
      "THE big one. Your hands want `dw`. meow has no operators: select the word with `w`, then **`s`** to kill it. (`d` would also delete the selection, but `s` is the idiom and saves it to the kill-ring.)",
    keys: [
      { key: "w", desc: "mark (select) the word" },
      { key: "s", desc: "kill the selection (cut)" },
      { key: "e / b", desc: "move by word, selecting" },
    ],
    buffer: ["the quick brown fox jumps garbage"],
    goal: { type: "text", target: ["the quick brown fox jumps"] },
    goalText: 'Select "garbage" with w and kill it with s.',
  },
  {
    id: "line-kill",
    title: "6 · Select a whole line",
    intro:
      "`x` selects the entire current line. Press it again to swallow the next line too. Then `s` kills the selection.\n\nDelete the shouty middle line.",
    vimNote:
      "Trap! In vim `x` deletes one character. In meow `x` selects the **whole line**. Try it and see — then `s` to remove it. (vim's `dd` becomes `x s`.)",
    keys: [
      { key: "x", desc: "select line (again: extend down)" },
      { key: "s", desc: "kill the selection" },
    ],
    buffer: ["keep this line", "DELETE THIS LINE", "and keep this one"],
    goal: { type: "text", target: ["keep this line", "and keep this one"] },
    goalText: "Move to the middle line, select it with x, kill it with s.",
  },
  {
    id: "symbols",
    title: "7 · Words vs symbols",
    intro:
      "A **word** stops at punctuation. A **symbol** is a whole chunk of non-whitespace — it eats through dashes, dots and underscores. Lowercase keys work on words; uppercase work on symbols:\n- `w` mark word · `W` mark symbol\n- `e`/`b` move by word · `E`/`B` move by symbol\n\nThe trailing token has dashes and dots. A `w` would only grab a piece of it — use `W`.",
    vimNote:
      "Like vim's `w` vs `W` distinction, but here they *select* rather than just move.",
    keys: [
      { key: "W", desc: "mark the whole symbol" },
      { key: "s", desc: "kill it" },
    ],
    buffer: ["clean up this mess: foo-bar.baz_qux"],
    goal: { type: "text", target: ["clean up this mess:"] },
    goalText: 'Select the symbol "foo-bar.baz_qux" with W and kill it.',
  },
  {
    id: "extend",
    title: "8 · Extending a selection",
    intro:
      "To grow a selection over several words, first **mark** one with `w` — that makes an *expandable* selection. Then each `e` extends it to the next word, and `b` extends back. (A bare `e` with nothing marked just moves word-to-word, selecting one at a time — `w` is what anchors it.) You can also grow character-by-character with `H J K L`.\n\nThree junk words lead the line. Select all three, then kill them.",
    vimNote:
      "No `d3w` here. Anchor with `w`, extend with `e`/`b` until the selection covers what you want, then strike. What you select is what you get.",
    keys: [
      { key: "w", desc: "mark a word (the anchor)" },
      { key: "e", desc: "extend to the next word" },
      { key: "b", desc: "extend back a word" },
      { key: "s", desc: "kill the selection" },
    ],
    buffer: ["junk junk junk keep this part"],
    goal: { type: "text", target: ["keep this part"] },
    goalText: "Mark the first junk (w), extend over the next two (e e), then s.",
  },
  {
    id: "expand",
    title: "9 · Reverse & expand",
    intro:
      "Once you have a selection, a **digit** `1`–`9` grows it by that many units of its kind — words for a word selection, lines for a line selection. And `;` reverses the selection, flipping which end the cursor is on so you can grow it the other way.\n\nDelete the first three lines in one go.",
    vimNote:
      "No `d3j` or `3dd`. You build the selection visibly — `x` then a number — then strike. What you see selected is exactly what gets killed.",
    keys: [
      { key: "x", desc: "select the line" },
      { key: "1-9", desc: "expand by N units" },
      { key: ";", desc: "reverse the selection" },
    ],
    buffer: ["line one", "line two", "line three", "keep this one"],
    goal: { type: "text", target: ["keep this one"] },
    goalText: "Select a line with x, press 3 to grab three lines, then s.",
  },

  // --- acting on a selection ---
  {
    id: "change",
    title: "10 · Change",
    intro:
      "`c` changes the selection: it deletes the selected text and drops you straight into Insert mode, ready to type the replacement.\n\nSwap one word for another below.",
    vimNote:
      "vim's `cw` is two ideas (operator + motion). meow's version is `w` then `c` — select the word, then change it.",
    keys: [
      { key: "w", desc: "select the word" },
      { key: "c", desc: "change: delete + Insert mode" },
      { key: "Esc", desc: "finish typing" },
    ],
    buffer: ["the cat sat on the mat"],
    goal: { type: "text", target: ["the dog sat on the mat"] },
    goalText: 'Select "cat", change it to "dog".',
  },
  {
    id: "yank",
    title: "11 · Copy & paste",
    intro:
      "`y` saves (copies) the selection. `p` yanks it back — pastes at the cursor. Together with `x` (line select) you can duplicate a line fast.\n\nMake a second copy of the line below.",
    vimNote:
      "meow's clipboard verbs: `y` = copy (save), `s` = cut (kill), `p` = paste (yank). vim's `yy p` becomes `x y p`.",
    keys: [
      { key: "x", desc: "select the line" },
      { key: "y", desc: "save (copy) it" },
      { key: "p", desc: "paste at the cursor" },
    ],
    buffer: ["copy me"],
    goal: { type: "text", target: ["copy me", "copy me"] },
    goalText: "Select the line with x, copy with y, paste a duplicate with p.",
  },
  {
    id: "replace",
    title: "12 · Replace",
    intro:
      "`r` replaces the current selection with whatever you last copied (`y`) or cut (`s`) — it pastes *over* the selection. Unlike `c`, you don't retype; unlike `p`, it overwrites instead of inserting.\n\nCopy one word and stamp it over another.",
    vimNote:
      "In vim `r` replaces a single character (`r` then the new char). In meow `r` overwrites the whole selection with the kill-ring — copy with `y` first, select a span, then `r`.",
    keys: [
      { key: "w", desc: "mark the word" },
      { key: "y", desc: "save (copy) it" },
      { key: "r", desc: "replace selection with the kill-ring" },
    ],
    buffer: ["copy dog onto cat"],
    goal: { type: "text", target: ["copy dog onto dog"] },
    goalText: 'Copy "dog" (w y), select "cat", then r to stamp "dog" over it.',
  },

  // --- advanced motions & objects ---
  {
    id: "find",
    title: "13 · Find & till",
    intro:
      "`f` then a character selects from the cursor up to **and including** the next occurrence of that character. `t` (till) selects up to but **not including** it.\n\nThe useful part for a vimmer: these *select*, so you can immediately act with `s`, `c`, or `d`.\n\nDelete everything up to and including the first comma below.",
    vimNote:
      "Pure muscle memory — `f` and `t` are the same keys as vim. The twist is they leave a selection (vim just moves). Need to search backward? Prefix with `-`.",
    keys: [
      { key: "f", desc: "find: select up to & incl. a char" },
      { key: "t", desc: "till: select up to a char" },
      { key: "s", desc: "kill the selection" },
    ],
    buffer: ["foo, and the rest stays"],
    goal: { type: "text", target: ["and the rest stays"] },
    goalText: "Press f then , to select through the comma, then s to kill it.",
  },
  {
    id: "things",
    title: "14 · Text objects (things)",
    intro:
      "meow's secret weapon. `,` selects the **inner** part of a *thing*; `.` selects its **bounds** (including the delimiters). After the prefix, name the thing:\n- `r` round `()` · `s` square `[]` · `c` curly `{}`\n- `g` a quoted string · `l` line · `p` paragraph · `b` whole buffer\n\nThe cursor is inside the parentheses below. Replace the contents.",
    vimNote:
      "This is meow's `ci(`. `,` = inner (vim's `i`), `.` = bounds (vim's `a`). So `, r` then `c` is exactly `ci(`. Heads-up: `.` here is bounds-of-thing, **not** vim's repeat-last-edit.",
    keys: [
      { key: ", r", desc: "inner of ( )" },
      { key: ". r", desc: "bounds of ( ) incl. parens" },
      { key: ", g", desc: "inside a \"string\"" },
      { key: "c", desc: "change the selection" },
    ],
    buffer: ["call(old)"],
    goal: { type: "text", target: ["call(new)"] },
    goalText: 'Select inside the parens with , r, then change "old" to "new".',
  },

  // --- graduation (prose-only outro) ---
  {
    id: "graduation",
    kind: "info",
    title: "✦ You did it",
    intro:
      "**Congratulations — you've finished the tutor!** 🎉\n\nYou now know the whole core loop: modes and motion, building and refining a selection, and acting on it with change, kill, copy, paste, replace, find, and text objects. That's the meow muscle — *select, then act*.",
    body:
      "**Next step: keep the muscle warm.** Reading about the keys isn't the same as having them in your fingers — that's what the **Gym** is for. It throws timed and randomly-generated challenges at you so the motions become automatic:\n- **Fix, Navigate, Delete, Golf** — focused drills, one skill at a time\n- **Master Shifu** 🥋 and **Master Oogway** 🐢 — timed gauntlets that mix everything together\n\nForgotten a key? The [**Keymap** tab](route:keymap) is your `C-h b` — the full binding reference, any time.\n\nWhen you're ready to use meow for real, install it in Emacs from [the meow project](https://github.com/meow-edit/meow). See you in the Gym.",
  },
];
