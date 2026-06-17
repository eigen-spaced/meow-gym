import { KEYMAP } from "./keymap";
import { escapeHtml } from "./html";

/** The "C-h b · describe-bindings" reference page (pure presentation of KEYMAP). */
export function keymapView(): HTMLElement {
  const main = document.createElement("main");
  main.className = "content";

  const h = document.createElement("h2");
  h.textContent = "C-h b · describe-bindings";
  const p = document.createElement("p");
  p.className = "muted";
  p.innerHTML =
    "The full meow QWERTY normal-state keymap. The <span class='vim-badge'>vim habit</span> column flags keys where your old reflexes will lead you astray.";
  main.append(h, p);

  const table = document.createElement("table");
  table.className = "keymap";
  table.innerHTML = `
      <thead><tr><th>Key</th><th>Command</th><th>meow does</th><th>vim habit</th></tr></thead>
    `;
  const tbody = document.createElement("tbody");
  for (const b of KEYMAP) {
    const tr = document.createElement("tr");
    const trap = b.vim && !/same|similar/.test(b.vim);
    tr.innerHTML =
      `<td><kbd>${escapeHtml(b.key)}</kbd></td>` +
      `<td><code>${escapeHtml(b.command)}</code></td>` +
      `<td>${escapeHtml(b.desc)}</td>` +
      `<td class="${trap ? "trap" : "muted"}">${
        b.vim ? escapeHtml(b.vim) : "—"
      }</td>`;
    tbody.append(tr);
  }
  table.append(tbody);
  main.append(table);
  return main;
}
