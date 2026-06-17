// The full meow QWERTY Normal-mode keymap, for the reference page.
// Source: meow-edit/meow KEYBINDING_QWERTY.org

export interface KeyBinding {
  key: string;
  command: string;
  desc: string;
  /** Optional "vim does X instead" note for the reference page. */
  vim?: string;
}

export const KEYMAP: KeyBinding[] = [
  { key: "0-9", command: "meow-expand-N", desc: "Expand selection by N" },
  { key: "-", command: "negative-argument", desc: "Apply a negative argument" },
  { key: ";", command: "meow-reverse", desc: "Reverse the selection", vim: "repeat f/t search" },
  { key: ",", command: "meow-inner-of-thing", desc: "Select inner content of a thing" },
  { key: ".", command: "meow-bounds-of-thing", desc: "Select bounds of a thing" },
  { key: "[", command: "meow-beginning-of-thing", desc: "Jump to beginning of a thing" },
  { key: "]", command: "meow-end-of-thing", desc: "Jump to end of a thing" },
  { key: "a", command: "meow-append", desc: "Append after the cursor/selection", vim: "append after cursor (similar)" },
  { key: "A", command: "meow-open-below", desc: "Open a line below + insert", vim: "o opens below" },
  { key: "b", command: "meow-back-word", desc: "Move back a word, selecting", vim: "back a word (move only)" },
  { key: "B", command: "meow-back-symbol", desc: "Move back a symbol, selecting" },
  { key: "c", command: "meow-change", desc: "Change the selection (delete + insert)", vim: "change operator (cw, cc)" },
  { key: "d", command: "meow-delete", desc: "Delete selection / char", vim: "delete operator (dd, dw)" },
  { key: "D", command: "meow-backward-delete", desc: "Delete backward" },
  { key: "e", command: "meow-next-word", desc: "Move forward a word, selecting", vim: "end of word (move only)" },
  { key: "E", command: "meow-next-symbol", desc: "Move forward a symbol, selecting" },
  { key: "f", command: "meow-find", desc: "Find a character forward" },
  { key: "g", command: "meow-cancel-selection", desc: "Cancel the selection", vim: "goto prefix (gg)" },
  { key: "G", command: "meow-grab", desc: "Grab / extend selection" },
  { key: "h", command: "meow-left", desc: "Move left", vim: "same" },
  { key: "H", command: "meow-left-expand", desc: "Expand selection left" },
  { key: "i", command: "meow-insert", desc: "Insert at selection start", vim: "insert before cursor (similar)" },
  { key: "I", command: "meow-open-above", desc: "Open a line above + insert", vim: "insert at line start" },
  { key: "j", command: "meow-next", desc: "Move down", vim: "same" },
  { key: "J", command: "meow-next-expand", desc: "Expand selection down" },
  { key: "k", command: "meow-prev", desc: "Move up", vim: "same" },
  { key: "K", command: "meow-prev-expand", desc: "Expand selection up" },
  { key: "l", command: "meow-right", desc: "Move right", vim: "same" },
  { key: "L", command: "meow-right-expand", desc: "Expand selection right" },
  { key: "m", command: "meow-join", desc: "Join lines" },
  { key: "n", command: "meow-search", desc: "Search" },
  { key: "o", command: "meow-block", desc: "Select the block (brackets)", vim: "open line below" },
  { key: "O", command: "meow-to-block", desc: "Extend to the block" },
  { key: "p", command: "meow-yank", desc: "Yank (paste) at the cursor", vim: "paste after (similar)" },
  { key: "q", command: "meow-quit", desc: "Quit / close" },
  { key: "Q", command: "meow-goto-line", desc: "Go to a line" },
  { key: "r", command: "meow-replace", desc: "Replace the selection" },
  { key: "R", command: "meow-swap-grab", desc: "Swap grab position" },
  { key: "s", command: "meow-kill", desc: "Kill (cut) the selection", vim: "substitute char" },
  { key: "t", command: "meow-till", desc: "Select till a character" },
  { key: "u", command: "meow-undo", desc: "Undo", vim: "same" },
  { key: "U", command: "meow-undo-in-selection", desc: "Undo within selection" },
  { key: "v", command: "meow-visit", desc: "Visit a location", vim: "visual mode" },
  { key: "w", command: "meow-mark-word", desc: "Mark (select) the word", vim: "next word (move only)" },
  { key: "W", command: "meow-mark-symbol", desc: "Mark (select) the symbol" },
  { key: "x", command: "meow-line", desc: "Select the whole line", vim: "delete a character" },
  { key: "X", command: "meow-goto-line", desc: "Go to a line" },
  { key: "y", command: "meow-save", desc: "Save (copy) the selection", vim: "yank operator (yy)" },
  { key: "Y", command: "meow-sync-grab", desc: "Sync grab state" },
  { key: "z", command: "meow-pop-selection", desc: "Pop the last selection" },
  { key: "'", command: "repeat", desc: "Repeat the last command" },
];
