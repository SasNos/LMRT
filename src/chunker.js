import { MAX_CHUNK_LENGTH } from "./constants.js";

// Speech engines stall on long utterances, so text is spoken in short chunks.
export function splitText(text, maxLength = MAX_CHUNK_LENGTH) {
  const sentences = text.split(/(?<=[.!?…:;])\s+/).filter(Boolean);
  const chunks = [];
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > maxLength) {
      let cut = rest.lastIndexOf(" ", maxLength);
      if (cut <= 0) cut = maxLength;
      chunks.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

export function buildChunks(blocks) {
  const chunks = [];
  blocks.forEach((block, blockIndex) => {
    if (!block.speak) return;
    for (const text of splitText(block.text)) chunks.push({ text, blockIndex });
  });
  return chunks;
}
