import test from "node:test";
import assert from "node:assert/strict";
import { parseMarkdown, stripInline } from "../src/markdown.js";

const texts = (md) => parseMarkdown(md).map((b) => `${b.kind}:${b.text}`);

test("stripInline removes markup and keeps the words", () => {
  assert.equal(stripInline("**bold** _it_ ~~gone~~ `code` [link](http://x) ![alt](i.png) <b>t</b>"), "bold it gone code link alt t");
  assert.equal(stripInline("[ref][1] and \\*literal\\*"), "ref and *literal*");
});

test("headings, paragraphs, lists, quotes", () => {
  const md = "# Title ##\n\nfirst line\nsecond line\n\n- [x] item one\n1. item two\n> quoted";
  assert.deepEqual(texts(md), [
    "heading:Title",
    "paragraph:first line second line",
    "list-item:item one",
    "list-item:item two",
    "quote:quoted",
  ]);
});

test("front matter, BOM and rules are skipped; CRLF works", () => {
  const md = "﻿---\r\ntitle: x\r\n---\r\n# A\r\n***\r\ntext";
  assert.deepEqual(texts(md), ["heading:A", "paragraph:text"]);
});

test("code blocks are shown but not spoken, even when unterminated", () => {
  const blocks = parseMarkdown("before\n```js\nlet a = 1;\n```\nafter\n~~~\nopen");
  assert.deepEqual(
    blocks.map((b) => [b.kind, b.speak]),
    [["paragraph", true], ["code", false], ["paragraph", true], ["code", false]],
  );
  assert.equal(blocks[1].text, "let a = 1;");
});

test("tables are read row by row", () => {
  const md = "| Name | Age |\n|---|---|\n| Ann | 3 |\n| Bob | 4 |\n\nnot a row | but pipe";
  assert.deepEqual(texts(md), [
    "table-row:Name, Age",
    "table-row:Ann, 3",
    "table-row:Bob, 4",
    "paragraph:not a row | but pipe",
  ]);
});

test("garbage input never throws", () => {
  assert.deepEqual(parseMarkdown(undefined), []);
  assert.deepEqual(parseMarkdown(null), []);
  assert.deepEqual(parseMarkdown(""), []);
  assert.deepEqual(parseMarkdown(">\n```\n```\n***"), [{ kind: "code", text: "", speak: false }]);
  assert.deepEqual(texts("#\n\n-"), ["paragraph:#", "paragraph:-"]);
  assert.deepEqual(texts("Grüße 日本語 🎉"), ["paragraph:Grüße 日本語 🎉"]);
  assert.equal(parseMarkdown("x".repeat(100000)).length, 1);
});
