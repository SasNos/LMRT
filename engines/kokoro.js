// Browser binding (not unit-tested, see docs/STATUS.md): Kokoro-82M through kokoro-js (transformers.js) on
// WebGPU. Bundled into dist/kokoro.js by scripts/build.mjs; loaded only when a Kokoro voice speaks. The model
// files are already in the caches it reads (see engines/install.js), so it does not download anything.
import { env } from '@huggingface/transformers';
import { KokoroTTS } from 'kokoro-js';
import { KOKORO_DEVICE, KOKORO_DTYPE, KOKORO_MODEL_ID } from '../src/kokoro.js';
import { opfsCache } from './opfs-cache.js';

env.backends.onnx.wasm.wasmPaths = new URL('./vendor/kokoro/', import.meta.url).href;
// The model files are read from the file system cache that engines/install.js filled with pinned, verified
// files; a cache miss must fail, never fetch.
env.allowRemoteModels = false;
env.useBrowserCache = false;
env.useCustomCache = true;
env.customCache = opfsCache;

let loading = null;
let queue = Promise.resolve();
const serial = (task) => {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
};

function load() {
  loading ??= KokoroTTS.from_pretrained(KOKORO_MODEL_ID, { dtype: KOKORO_DTYPE, device: KOKORO_DEVICE }).catch(
    (error) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export function synthesize(text, voice, speed) {
  return serial(async () => {
    const tts = await load();
    const audio = await tts.generate(text, { voice: voice.kokoroVoice, speed });
    return { samples: audio.audio, sampleRate: audio.sampling_rate };
  });
}
