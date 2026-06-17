import type { VimHint } from "./types";

/**
 * The "for vimmers" feature.
 *
 * These are keys where vim muscle memory misfires: the key exists in meow but
 * means something different. When a learner hits one, we still perform meow's
 * real action (that's the whole point of learning), and surface a gentle nudge
 * explaining the mix-up.
 *
 * We deliberately do NOT flag keys that mean roughly the same thing in both
 * editors (h/j/k/l, u for undo) — nagging about those would be noise.
 */
export const VIM_HINTS: Record<string, Omit<VimHint, "key">> = {
  x: {
    vim: "delete the character under the cursor",
    meow: "selects the whole line",
    tip: "To delete a char in meow, just press d. To delete a line: x then s.",
  },
  d: {
    vim: "start a delete operator (dd, dw, d$)",
    meow: "deletes the selection right now (or one char if nothing is selected)",
    tip: "meow has no operators. Select first (w, x, e…), then kill with s.",
  },
  s: {
    vim: "substitute: delete a char and enter insert mode",
    meow: "kills (cuts) the current selection into the kill-ring",
    tip: "This is meow's main 'delete this': select with w/x/e, then s.",
  },
  c: {
    vim: "start a change operator (cw, cc)",
    meow: "changes the selection: deletes it and drops you into insert mode",
    tip: "Select first, then c — there's no cw, the selection is the motion.",
  },
  o: {
    vim: "open a new line below and enter insert mode",
    meow: "selects the block (matching brackets) around the cursor",
    tip: "To open a line below in meow, press A. Above is I.",
  },
  v: {
    vim: "enter visual (character) selection mode",
    meow: "visit: jump to a previously selected/searched thing",
    tip: "meow is always 'visual' — selections are the default, no mode needed.",
  },
  p: {
    vim: "paste after the cursor",
    meow: "yanks (pastes) the kill-ring — close, but it pastes at the cursor",
    tip: "Pretty similar! Note meow's copy is y (save), and cut is s (kill).",
  },
  r: {
    vim: "replace a single character (r then the new char)",
    meow: "replaces the selection with the kill-ring (paste over)",
    tip: "Copy with y first, then select a span and r to overwrite it.",
  },
  y: {
    vim: "start a yank/copy operator (yy, yw)",
    meow: "saves (copies) the current selection — no operator needed",
    tip: "Select first, then y. Paste it back with p.",
  },
  w: {
    vim: "move forward to the start of the next word",
    meow: "marks (selects) the whole word under the cursor",
    tip: "meow's w gives you a selection to act on. To move by word, use e / b.",
  },
  b: {
    vim: "move backward to the start of the previous word",
    meow: "moves back a word and selects it along the way",
    tip: "Close to vim, but it leaves a selection behind — handy for d/s/c.",
  },
  e: {
    vim: "move to the end of the current/next word",
    meow: "moves forward a word, selecting it",
    tip: "Like vim's w+selection. Pair it with d, s, or c.",
  },
  i: {
    vim: "insert before the cursor",
    meow: "inserts at the start of the selection (or before the cursor)",
    tip: "Almost identical — just remember it respects the selection's start.",
  },
  a: {
    vim: "append after the cursor",
    meow: "appends at the end of the selection (or after the cursor)",
    tip: "Like vim, but anchored to the selection's end.",
  },
  ";": {
    vim: "repeat the last f/t character search",
    meow: "reverses the selection (swaps which end the cursor is on)",
    tip: "Useful after w/x to grow the selection from the other side.",
  },
  g: {
    vim: "prefix for goto commands (gg, gd…)",
    meow: "cancels the current selection",
    tip: "Press g when you want to drop a selection and just have a cursor.",
  },
};

export function lookupVimHint(key: string): Omit<VimHint, "key"> | undefined {
  return VIM_HINTS[key];
}
