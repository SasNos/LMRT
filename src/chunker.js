import { BLOCK_PAUSE_MS, MAX_CHUNK_LENGTH, SENTENCE_PAUSE_MS } from './constants.js';

// Speech engines stall on long utterances, so text is spoken in short chunks.
// Pieces of the text; `sentenceEnd` is false for a piece that was cut out of a longer sentence.
function splitPieces(text, maxLength) {
  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks = [];
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > maxLength) {
      // Prefer a comma in the second half (keeps the melody of the sentence), then a space.
      const comma = rest.lastIndexOf(',', maxLength - 1);
      let cut = comma >= maxLength / 2 ? comma + 1 : rest.lastIndexOf(' ', maxLength);
      if (cut <= 0) cut = maxLength;
      chunks.push({ text: rest.slice(0, cut).trim(), sentenceEnd: false });
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push({ text: rest, sentenceEnd: true });
  }
  return chunks;
}

export function splitText(text, maxLength = MAX_CHUNK_LENGTH) {
  return splitPieces(text, maxLength).map((piece) => piece.text);
}

export function buildChunks(blocks) {
  const chunks = [];
  blocks.forEach((block, blockIndex) => {
    if (!block.speak) return;
    const pieces = splitPieces(block.text, MAX_CHUNK_LENGTH);
    const blockPause = Object.hasOwn(BLOCK_PAUSE_MS, block.kind)
      ? BLOCK_PAUSE_MS[block.kind]
      : BLOCK_PAUSE_MS.paragraph;
    pieces.forEach(({ text, sentenceEnd }, i) => {
      // A piece cut out of a long sentence gets no pause: the sentence goes on.
      const pause = i === pieces.length - 1 ? blockPause : sentenceEnd ? SENTENCE_PAUSE_MS : 0;
      chunks.push({ text, blockIndex, pause });
    });
  });
  return chunks;
}
