import test from "node:test";
import assert from "node:assert/strict";
import { buildChunks, splitText } from "../src/chunker.js";

test("splits at sentence ends", () => {
  assert.deepEqual(splitText("One. Two! Three?"), ["One.", "Two!", "Three?"]);
});

test("splits long sentences at spaces, and hard-cuts unbroken text", () => {
  assert.deepEqual(splitText("aaa bbb ccc ddd", 7), ["aaa bbb", "ccc ddd"]);
  assert.deepEqual(splitText("abcdefghij", 4), ["abcd", "efgh", "ij"]);
});

test("empty text gives no chunks", () => {
  assert.deepEqual(splitText(""), []);
});

test("buildChunks skips unspoken blocks and keeps block indexes", () => {
  const blocks = [
    { text: "A. B.", speak: true },
    { text: "code", speak: false },
    { text: "C", speak: true },
  ];
  assert.deepEqual(buildChunks(blocks), [
    { text: "A.", blockIndex: 0 },
    { text: "B.", blockIndex: 0 },
    { text: "C", blockIndex: 2 },
  ]);
});
