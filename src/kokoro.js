import pins from './kokoro-pins.json' with { type: 'json' };
import { ALLOWED_PREFIX } from './download.js';

export const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
// fp32: fp16 produced NaN samples on WebGPU (measured 2026-11-11).
export const KOKORO_DTYPE = 'fp32';
export const KOKORO_DEVICE = 'webgpu';

const BASE = `${ALLOWED_PREFIX}${KOKORO_MODEL_ID}/resolve/main`;
const MODEL_PATH = 'onnx/model.onnx';

// The files transformers.js and kokoro-js read for one voice. They are downloaded by LMRT, checked against
// their pinned SHA-256 and put into the caches those libraries read (see `cache` in kokoro-pins.json), so they never fetch anything themselves.
export function kokoroFilesFor(voiceName) {
  const voice = Object.hasOwn(pins.voices, voiceName) ? pins.voices[voiceName] : null;
  if (!voice) throw new Error('Unknown Kokoro voice');
  return [...pins.shared, voice];
}

export const kokoroUrl = (file) => `${BASE}/${file.path}`;

// The two files that make up the size shown to the user: the model (shared) and the voice.
export function kokoroSizeFiles(voiceName) {
  return { model: kokoroFilesFor(voiceName).find((file) => file.path === MODEL_PATH), voice: pins.voices[voiceName] };
}
