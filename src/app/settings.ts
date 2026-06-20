// Small persisted UI settings.

const REL_NUM = "meow-gym.relnum";
const VIM_HINTS = "meow-gym.vimhints";

export function getRelativeNumbers(): boolean {
  try {
    return localStorage.getItem(REL_NUM) === "1";
  } catch {
    return false;
  }
}

export function setRelativeNumbers(on: boolean): void {
  try {
    localStorage.setItem(REL_NUM, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Whether to show the "vim habit" nudges. On by default; off for non-vimmers. */
export function getVimHints(): boolean {
  try {
    return localStorage.getItem(VIM_HINTS) !== "0";
  } catch {
    return true;
  }
}

export function setVimHints(on: boolean): void {
  try {
    localStorage.setItem(VIM_HINTS, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
