# Attribution

**meow gym** is an independent, original web application — a practice ground for
the Emacs **meow** modal editor, aimed at people coming from Vim. It wouldn't
exist without the projects below.

## meow

- Repository: <https://github.com/meow-edit/meow>
- License: GPL-3.0
- meow is the modal editor this app teaches and drills. Two things here are
  informed by meow:
  - The QWERTY keybinding reference (`src/app/keymap.ts`) is **factual data**
    transcribed from meow's [`KEYBINDING_QWERTY.org`](https://github.com/meow-edit/meow/blob/master/KEYBINDING_QWERTY.org).
  - The lesson ordering is loosely informed by meow's built-in tutorial,
    [`meow-tutor.el`](https://github.com/meow-edit/meow/blob/master/meow-tutor.el).
- Everything else — the from-scratch modal-editor engine, all lesson prose, the
  puzzle generators, the live-diff beacon system, and the UI — is original to
  this project. No meow source code is included or copied here, so this project
  is released under the MIT license (see `LICENSE`).

## vim-gym

- Inspiration for several puzzle *formats* (delete-the-highlighted, navigate-to-
  target, yank-to-marker). The puzzles here are re-imagined for meow's
  selection-first model rather than Vim's operators.

## Vim

- The "for vimmers" framing and the muscle-memory hints reference Vim's keymap,
  contrasting it with meow's so the differences stick.

---

The name **meow gym** was chosen to avoid confusion with `meow-tutor`, meow's own
built-in tutorial.
