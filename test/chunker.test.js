import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChunks, splitText } from '../src/chunker.js';
import { parseMarkdown } from '../src/markdown.js';
import { BLOCK_PAUSE_MS, SENTENCE_PAUSE_MS } from '../src/constants.js';

test('splits at sentence ends', () => {
  assert.deepEqual(splitText('One. Two! Three?'), ['One.', 'Two!', 'Three?']);
});

test('splits long sentences at spaces, and hard-cuts unbroken text', () => {
  assert.deepEqual(splitText('aaa bbb ccc ddd', 7), ['aaa bbb', 'ccc ddd']);
  assert.deepEqual(splitText('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
});

test('empty text gives no chunks', () => {
  assert.deepEqual(splitText(''), []);
});

test('buildChunks skips unspoken blocks and keeps block indexes', () => {
  const blocks = [
    { kind: 'paragraph', text: 'A. B.', speak: true },
    { kind: 'code', text: 'code', speak: false },
    { kind: 'heading', text: 'C', speak: true },
  ];
  assert.deepEqual(buildChunks(blocks), [
    { text: 'A.', blockIndex: 0, pause: SENTENCE_PAUSE_MS },
    { text: 'B.', blockIndex: 0, pause: BLOCK_PAUSE_MS.paragraph },
    { text: 'C', blockIndex: 2, pause: BLOCK_PAUSE_MS.heading },
  ]);
});

test('an unknown or missing block kind uses the paragraph pause', () => {
  const pause = (kind) => buildChunks([{ kind, text: 'x', speak: true }])[0].pause;
  assert.equal(pause('other'), BLOCK_PAUSE_MS.paragraph);
  assert.equal(pause(undefined), BLOCK_PAUSE_MS.paragraph);
  assert.equal(pause('__proto__'), BLOCK_PAUSE_MS.paragraph);
});

test('every spoken block kind the Markdown parser produces has its own pause', () => {
  const table = ['| a | b |', '| - | - |', '| c | d |'].join('\n');
  const source = ['# H', 'Text.', '> Quote', '- item', table].join('\n\n');
  const kinds = new Set(
    parseMarkdown(source)
      .filter((block) => block.speak)
      .map((block) => block.kind),
  );
  assert.deepEqual([...kinds].sort(), ['heading', 'list-item', 'paragraph', 'quote', 'table-row']);
  for (const kind of kinds) assert.ok(Object.hasOwn(BLOCK_PAUSE_MS, kind), kind);
});

test('colons and semicolons do not end a chunk', () => {
  assert.deepEqual(splitText('Note: one; two. Three.'), ['Note: one; two.', 'Three.']);
});

test('a long sentence is cut at a comma before any other space', () => {
  assert.deepEqual(splitText('aaa bbb, ccc ddd eee', 14), ['aaa bbb,', 'ccc ddd eee']);
  assert.deepEqual(splitText('aaa bbb ccc ddd', 9), ['aaa bbb', 'ccc ddd']);
});

test('pieces of a long sentence cut by length get no sentence pause, the block end keeps its pause', () => {
  const long = `${'word '.repeat(60)}end.`;
  const chunks = buildChunks([{ kind: 'list-item', text: long, speak: true }]);
  assert.ok(chunks.length > 1);
  assert.deepEqual(
    chunks.slice(0, -1).map((c) => c.pause),
    new Array(chunks.length - 1).fill(0),
  );
  assert.equal(chunks.at(-1).pause, BLOCK_PAUSE_MS['list-item']);
});
