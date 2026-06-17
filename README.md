# meow gym · for vimmers 🐱

A practice ground for the [Emacs **meow**](https://github.com/meow-edit/meow)
modal editor — built for people whose fingers still think in Vim.

You type into a real (simulated) meow buffer. Lessons walk you through the
basics; puzzles drill them under pressure. When your Vim muscle memory misfires —
pressing `x` to delete a char, `dw` to delete a word — the editor still does the
*meow* thing and tells you, in the echo area, what just happened and what to
press instead.

> Named **meow gym** to avoid clashing with `meow-tutor`, meow's own built-in
> tutorial.

## What's inside

- **Tutor** — 13 progressive lessons: modes, `hjkl`, deletion, insert variants,
  select-then-act (`w`/`s`), line selection (`x`), words vs symbols, extending
  selections, change, copy/paste, find/till (`f`/`t`), text objects (`,`/`.` of a
  thing), and reverse/expand (`;`/digits). Each has a live buffer and a goal
  checked as you type. Progress is saved locally.
- **For-vimmers hints** — keys where Vim habit betrays you trigger an Emacs-style
  echo-area nudge: `x runs the command meow-line — selects the whole line`.
- **Puzzles** — themed groups, most freshly generated each round so they never
  repeat:
  - **Fix words & typos** — clean a passage; the next thing to fix is always
    highlighted (color-coded: 🟥 delete · 🟧 fix · 🟩 insert · 🟦 duplicate).
  - **Navigate** — reach the highlighted spot in the fewest keys.
  - **Delete blocks** — meow's `o` grabs the nearest bracket pair (incl. nested
    Lisp s-expressions); kill it with `s`.
  - **Golf** — solve in the fewest keystrokes; graded S/A/B/C against par.
  - **Master Shifu** 🥋 — a timed gauntlet: 10 randomized puzzles across every
    skill, one continuous clock, beat your best time.
  - **Master Oogway** 🐢 — the final tier: compound passages with several defects
    at once, all mechanical, against the clock.
- **Keymap (`C-h b`)** — the full meow QWERTY normal-state keymap, with a column
  flagging which keys are Vim traps.

## Emacs-y by design

It leans into Emacs rather than dressing up: every editor widget is a real
**Emacs frame** — buffer + **modeline** (`NORMAL ** *gym* (Meow Fundamental) L3
C5`) + **echo area** (minibuffer). Monospace throughout, flat and rectangular, a
doom-one-ish palette with the Emacs-purple accent, and almost no animation.

## Run it

```bash
pnpm install
pnpm dev         # local dev server
pnpm build       # type-check + production build to dist/
pnpm verify      # drive lessons & puzzles through the engine, assert they solve
```

## Layout

```
src/
  editor/
    types.ts        # buffer / selection / mode model + TargetSpan
    goals.ts        # the Goal model + checkGoal (shared by lessons & puzzles)
    meow.ts         # the engine: meow's selection-first commands, modes, undo
    vimKeys.ts      # the "you're thinking in vim" hint map
    EditorView.ts   # focusable Emacs-frame widget (buffer + modeline + echo)
  lessons/
    lessons.ts      # the curriculum
    LessonView.ts
  puzzles/
    puzzles.ts      # puzzle groups + data + goal-checking
    generate.ts     # procedural puzzle generators (fix, oogway, gauntlet, …)
    diff.ts         # live diff → next beacon (drives multi-defect puzzles)
    grading.ts      # scoring: gradeRun (keys) + gradeGauntlet (time)
    progress.ts     # block progress bar + color legend
    PuzzleView.ts   # a single puzzle
    GroupView.ts    # a themed/endless group of puzzles
    GauntletView.ts # the timed gauntlets (Master Shifu / Master Oogway)
  app/
    keymap.ts       # full QWERTY keymap data
    KeymapView.ts   # the C-h b reference page
    markup.ts       # tiny safe markdown subset for lesson prose
    html.ts         # escapeHtml
    storage.ts      # guarded localStorage JSON helpers
    settings.ts     # persisted UI settings (relative line numbers)
  main.ts           # app shell: nav, sidebars, routing, progress persistence
  style.css
test/verify.ts      # headless solver: every lesson + puzzle archetype
```

The meow engine is written from scratch (not CodeMirror's vim mode) so it can
model meow's selection-first semantics faithfully and intercept Vim-habit keys.

## Credits & license

This is original work, MIT-licensed (see `LICENSE`). It stands on the shoulders
of **meow** (GPL-3.0) and is inspired by **vim-gym** — full credits in
[`ATTRIBUTION.md`](ATTRIBUTION.md).
