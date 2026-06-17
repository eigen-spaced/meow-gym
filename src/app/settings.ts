// Small persisted UI settings.

const REL_NUM = "meow-gym.relnum";

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
