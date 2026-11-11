// Turns Markdown text into reading blocks: { kind, text, speak }.
// Not a full Markdown renderer; it only needs to produce clean speakable text.

const ESCAPABLE = /\\([\\`*_{}[\]()#+\-.!|>~])/g;
const PARKED = /(\d+)/g;

export function stripInline(text) {
  // Escaped characters are parked as numeric placeholders so the emphasis rules ignore them.
  return text
    .replace(ESCAPABLE, (_, char) => `${char.charCodeAt(0)}`)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<[^>\n]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(PARKED, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n(---|\.\.\.)[ \t]*(\r?\n|$)/;

export function parseMarkdown(source) {
  const text = String(source ?? "")
    .replace(/^﻿/, "")
    .replace(FRONT_MATTER, "");
  const lines = text.split(/\r\n|\r|\n/);
  const blocks = [];
  let paragraph = [];
  let inTable = false;

  const push = (kind, raw) => {
    const clean = stripInline(raw);
    if (clean) blocks.push({ kind, text: clean, speak: true });
  };
  const flush = () => {
    if (paragraph.length) push("paragraph", paragraph.join(" "));
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const wasInTable = inTable;
    inTable = false;
    if (FENCE.test(line)) {
      flush();
      const marker = FENCE.exec(line)[1];
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith(marker)) {
        code.push(lines[i]);
        i += 1;
      }
      blocks.push({ kind: "code", text: code.join("\n"), speak: false });
    } else if (line.trim() === "") {
      flush();
    } else if (HEADING.test(line)) {
      flush();
      push("heading", HEADING.exec(line)[1]);
    } else if (RULE.test(line)) {
      flush();
    } else if (QUOTE.test(line)) {
      flush();
      push("quote", QUOTE.exec(line)[1]);
    } else if (LIST_ITEM.test(line)) {
      flush();
      push("list-item", LIST_ITEM.exec(line)[1]);
    } else if (line.includes("|") && TABLE_DIVIDER.test(lines[i + 1] ?? "")) {
      flush();
      push("table-row", tableCells(line));
      inTable = true;
      i += 1;
    } else if (wasInTable && line.includes("|")) {
      push("table-row", tableCells(line));
      inTable = true;
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
    .join(", ");
}
