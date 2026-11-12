// Browser binding (not unit-tested, see docs/STATUS.md): Piper inference with onnxruntime-web and the
// espeak-ng phonemizer. Bundled into dist/piper.js by scripts/build.mjs; loaded only when a voice is used.
import * as ort from 'onnxruntime-web/wasm';
import createPiperPhonemize from '@diffusionstudio/piper-wasm/build/piper_phonemize.js';
import { parsePhonemes, parsePiperConfig, phonemeIds, piperRunInputs } from '../src/piper-input.js';
import { readFile } from './store.js';

const VENDOR = new URL('./vendor/', import.meta.url).href;
ort.env.wasm.wasmPaths = VENDOR;
ort.env.wasm.numThreads = 1;

const sessions = new Map();
let queue = Promise.resolve();
// One model run at a time: a session rejects overlapping run() calls.
const serial = (task) => {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
};

async function loadVoice(voice) {
  if (!sessions.has(voice.id)) {
    const pending = (async () => {
      const [json, onnx] = await Promise.all([readFile(`${voice.id}.json`), readFile(`${voice.id}.onnx`)]);
      if (!json || !onnx) throw new Error('Voice is not installed');
      const config = parsePiperConfig(new TextDecoder().decode(json));
      return { config, session: await ort.InferenceSession.create(onnx, { executionProviders: ['wasm'] }) };
    })();
    sessions.set(voice.id, pending);
    pending.catch(() => sessions.delete(voice.id));
  }
  return sessions.get(voice.id);
}

async function phonemize(text, config) {
  let line = null;
  const phonemizer = await createPiperPhonemize({
    print: (output) => {
      line ??= output;
    },
    printErr: () => {},
    locateFile: (name) => VENDOR + name,
  });
  phonemizer.callMain([
    '-l',
    config.espeak.voice,
    '--input',
    JSON.stringify([{ text }]),
    '--espeak_data',
    '/espeak-ng-data',
  ]);
  return phonemeIds(parsePhonemes(line ?? ''), config.phoneme_id_map);
}

export function synthesize(text, voice, speed) {
  return serial(async () => {
    const { config, session } = await loadVoice(voice);
    const ids = await phonemize(text, config);
    const run = piperRunInputs(config, ids, speed);
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(run.ids, BigInt), [1, run.ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(run.ids.length)), [1]),
      scales: new ort.Tensor('float32', Float32Array.from(run.scales), [3]),
    };
    if (run.speaker !== null) feeds.sid = new ort.Tensor('int64', BigInt64Array.of(BigInt(run.speaker)), [1]);
    const { output } = await session.run(feeds);
    return { samples: output.data, sampleRate: config.audio.sample_rate };
  });
}
