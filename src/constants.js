export const MIN_RATE = 0.5;
export const MAX_RATE = 3;
export const DEFAULT_RATE = 1;
export const RATE_STEP = 0.1;
export const MAX_CHUNK_LENGTH = 200;
// Silence (ms at normal speed) after a chunk: between sentences of one block, and after the end of a block.
export const SENTENCE_PAUSE_MS = 200;
export const BLOCK_PAUSE_MS = { heading: 700, paragraph: 450, quote: 450, 'list-item': 250, 'table-row': 250 };
// Silence trimmed from neural output: samples below this share of the peak, keeping a short margin.
export const TRIM_THRESHOLD = 0.01;
export const TRIM_MARGIN_MS = 30;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const SETTINGS_KEY = 'lmrt.settings';
