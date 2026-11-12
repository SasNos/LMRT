import piperVoices from './piper-voices.json' with { type: 'json' };
import kokoroVoices from './kokoro-voices.json' with { type: 'json' };
import { ALLOWED_PREFIX } from './download.js';
import { kokoroSizeFiles } from './kokoro.js';

const PIPER_BASE = `${ALLOWED_PREFIX}rhasspy/piper-voices/resolve/main`;

export const NEURAL_VOICES = [
  ...piperVoices.map((voice) => ({ ...voice, neural: true })),
  ...kokoroVoices.map((voice) => ({ ...voice, neural: true, files: kokoroSizeFiles(voice.kokoroVoice) })),
];

export function piperUrls(voice) {
  return { onnx: `${PIPER_BASE}/${voice.path}.onnx`, json: `${PIPER_BASE}/${voice.path}.onnx.json` };
}

export function voiceSize(voice) {
  return Object.values(voice.files).reduce((sum, file) => sum + file.size, 0);
}

// Kokoro is only usable with WebGPU; on the CPU it is slower than real time (measured 2026-11-11).
export const isAvailable = (voice, hasWebGpu) => voice.engine !== 'kokoro' || hasWebGpu;

// A stored id maps to a neural voice, a system voice, or nothing.
export function resolveVoice(id, systemVoices, hasWebGpu = true) {
  const neural = NEURAL_VOICES.find((voice) => voice.id === id && isAvailable(voice, hasWebGpu));
  return neural ?? systemVoices.find((voice) => voice.voiceURI === id) ?? null;
}

export function voiceId(voice) {
  return voice.neural ? voice.id : voice.voiceURI;
}

export function voiceLabel(voice, installed) {
  if (!voice.neural) return `${voice.name} (${voice.lang}, system)`;
  const state = installed.has(voice.id) ? 'installed' : `download ${Math.round(voiceSize(voice) / 1e6)} MB`;
  return `${voice.name} (${voice.lang}, neural, ${state})`;
}

// Neural voices first (installed before not installed), then the system voices.
export function buildVoiceOptions(systemVoices, installed, hasWebGpu = true) {
  const neural = NEURAL_VOICES.filter((voice) => isAvailable(voice, hasWebGpu)).sort(
    (a, b) => Number(installed.has(b.id)) - Number(installed.has(a.id)),
  );
  return [...neural, ...systemVoices].map((voice) => ({
    id: voiceId(voice),
    label: voiceLabel(voice, installed),
    lang: voice.lang,
    voice,
  }));
}

export function pickDefaultVoice(systemVoices, installed, language) {
  const prefix = String(language ?? '')
    .slice(0, 2)
    .toLowerCase();
  const installedMatch = NEURAL_VOICES.find(
    (voice) => installed.has(voice.id) && voice.lang.toLowerCase().startsWith(prefix),
  );
  return installedMatch ?? systemVoices.find((voice) => voice.default) ?? systemVoices[0] ?? null;
}
