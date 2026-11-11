import test from "node:test";
import assert from "node:assert/strict";
import { ACCEPT, checkFile } from "../src/files.js";
import { MAX_FILE_BYTES } from "../src/constants.js";
import { parseMarkdown } from "../src/markdown.js";

test("accepts markdown files in any letter case", () => {
  assert.equal(checkFile({ name: "Notes.MD", size: 10 }).parse, parseMarkdown);
  assert.equal(checkFile({ name: "a.markdown", size: 0 }).ok, true);
  assert.equal(ACCEPT, ".md,.markdown");
});

test("rejects unsupported, nameless and prototype-named files", () => {
  for (const file of [{ name: "a.txt", size: 1 }, { name: "noext", size: 1 }, { name: ".toString", size: 1 }, { name: 5 }, null, undefined]) {
    assert.deepEqual(checkFile(file), { ok: false, error: "unsupported" });
  }
});

test("rejects oversized or invalid sizes", () => {
  for (const size of [MAX_FILE_BYTES + 1, -1, NaN, undefined]) {
    assert.deepEqual(checkFile({ name: "a.md", size }), { ok: false, error: "too-large" });
  }
  assert.equal(checkFile({ name: "a.md", size: MAX_FILE_BYTES }).ok, true);
});
