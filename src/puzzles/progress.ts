import type { TargetSpan } from "../editor/types";

// The shared color legend for highlighted jobs, used everywhere highlights show.
const LEGEND_CHIPS: Record<string, string> = {
  "t-del": `<span class="lg lg-del">delete</span>`,
  "t-fix": `<span class="lg lg-fix">fix</span>`,
  "t-yank": `<span class="lg lg-yank">duplicate</span>`,
  "t-ins": `<span class="lg lg-ins">insert</span>`,
  "t-nav": `<span class="lg lg-nav">go here</span>`,
};

/** Legend chips for the given set of job classes (stable order). */
export function legendHtmlFromCls(cls: string[]): string {
  const seen = new Set(cls);
  return Object.keys(LEGEND_CHIPS)
    .filter((c) => seen.has(c))
    .map((c) => LEGEND_CHIPS[c])
    .join("");
}

/** Legend chips for whichever job colors appear in `targets`. */
export function legendHtml(targets: TargetSpan[]): string {
  return legendHtmlFromCls(
    targets.map((t) => t.cls).filter((c): c is string => !!c),
  );
}

// A blocky, Emacs-flavored progress readout: one cell per puzzle, filled as you
// clear them. No gradients, no animation — just little blocks.

export function blockBar(label: string, done: number, total: number): string {
  let segs = "";
  for (let i = 0; i < total; i++) {
    segs += `<span class="seg${i < done ? " seg-on" : ""}"></span>`;
  }
  return (
    `<div class="progress-label">${label}</div>` +
    `<div class="blocks">${segs}</div>`
  );
}
