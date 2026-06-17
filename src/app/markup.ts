// A deliberately tiny, safe Markdown subset for lesson prose.
// Supports: paragraphs, "- " bullet lists, `inline code`, and **bold**.

import { escapeHtml } from "./html";

function inlineFormat(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<kbd>$1</kbd>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
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
