// Downloads the listed Piper voices and the Kokoro files once and writes their size and SHA-256 to
// src/piper-voices.json and src/kokoro-pins.json.
// The extension only accepts a downloaded voice whose hash matches. Run: node scripts/pin-voices.js
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
const VOICES = [
  { key: 'de_DE-thorsten-medium', name: 'Thorsten (medium)' },
  { key: 'de_DE-thorsten-high', name: 'Thorsten (high)' },
  { key: 'de_DE-ramona-low', name: 'Ramona (low)' },
  { key: 'de_DE-kerstin-low', name: 'Kerstin (low)' },
  { key: 'en_US-lessac-medium', name: 'Lessac (medium)' },
  { key: 'en_GB-alan-medium', name: 'Alan (medium)' },
];

async function pin(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}

const result = [];
const onlyKokoro = process.argv[2] === 'kokoro';
for (const { key, name } of onlyKokoro ? [] : VOICES) {
  const [locale, speaker, quality] = key.split('-');
  const path = `${locale.slice(0, 2)}/${locale}/${speaker}/${quality}/${key}`;
  console.log('pinning', key);
  result.push({
    id: `piper:${key}`,
    engine: 'piper',
    name,
    lang: locale.replace('_', '-'),
    path,
    files: { onnx: await pin(`${BASE}/${path}.onnx`), json: await pin(`${BASE}/${path}.onnx.json`) },
  });
}
if (!onlyKokoro) writeFileSync('src/piper-voices.json', `${JSON.stringify(result, null, 2)}\n`);

// Kokoro: the same files transformers.js and kokoro-js would fetch, pinned and later seeded into their caches.
const KOKORO_BASE = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
const kokoroVoices = JSON.parse(readFileSync('src/kokoro-voices.json', 'utf8'));
const shared = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model.onnx'];
const pins = { shared: [], voices: {} };
for (const path of shared) {
  console.log('pinning kokoro', path);
  pins.shared.push({ path, cache: 'opfs', ...(await pin(`${KOKORO_BASE}/${path}`)) });
}
for (const { kokoroVoice } of kokoroVoices) {
  const path = `voices/${kokoroVoice}.bin`;
  console.log('pinning kokoro', path);
  pins.voices[kokoroVoice] = { path, cache: 'kokoro-voices', ...(await pin(`${KOKORO_BASE}/${path}`)) };
}
writeFileSync(
  'src/kokoro-pins.json',
  `${JSON.stringify(pins, null, 2)}
`,
);
