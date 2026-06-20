// A deliberately tiny, safe Markdown subset for lesson prose.
// Supports: paragraphs, "- " bullet lists, `inline code`, **bold**, external
// [text](https://…) links, and in-app [text](route:tab) links — the latter
// render with a data-route attribute that the view wires to navigation.

import { escapeHtml } from "./html";

function inlineFormat(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<kbd>$1</kbd>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, href) => {
      // External http(s) links open in a new tab.
      if (/^https?:\/\//.test(href))
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      // In-app route links: route:tutor / route:puzzles / route:keymap.
      const route = /^route:([a-z]+)$/.exec(href);
      if (route)
        return `<a href="#${route[1]}" data-route="${route[1]}">${text}</a>`;
      // Anything else falls through unchanged.
      return m;
    });
}

/**
 * @param inline when true, returns only inline-formatted text (no <p>/<ul>).
 */
export function renderMarkup(text: string, inline = false): string {
  if (inline) return inlineFormat(text);

  const blocks = text.split(/\n\n+/);
  const html: string[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.every((l) => l.trimStart().startsWith("- "))) {
      const items = lines
        .map((l) => `<li>${inlineFormat(l.trimStart().slice(2))}</li>`)
        .join("");
      html.push(`<ul>${items}</ul>`);
    } else {
      html.push(`<p>${lines.map(inlineFormat).join("<br>")}</p>`);
    }
  }
  return html.join("");
}
