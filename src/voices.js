// The voice list: Pocket TTS voices the native host reports as installed, then the browser's system voices.
import { POCKET_LANGS } from './pocket.js';

const title = (name) =>
  name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

// `installed` is the checked status of the host: { german: ['juergen', ...], english: [...] }.
export function pocketVoices(installed) {
  return Object.entries(POCKET_LANGS).flatMap(([pocketLang, lang]) =>
    (installed?.[pocketLang] ?? []).map((pocketVoice) => ({
      id: `pocket:${pocketLang}:${pocketVoice}`,
      neural: true,
      name: title(pocketVoice),
      lang,
      pocketLang,
      pocketVoice,
    })),
  );
}

export const voiceId = (voice) => (voice.neural ? voice.id : voice.voiceURI);

export function voiceLabel(voice) {
  return `${voice.name} (${voice.lang}, ${voice.neural ? 'Pocket TTS' : 'system'})`;
}

// A stored id maps to a Pocket TTS voice, a system voice, or nothing.
export function resolveVoice(id, systemVoices, pocket) {
  return [...pocket, ...systemVoices].find((voice) => voiceId(voice) === id) ?? null;
}

export function buildVoiceOptions(systemVoices, pocket) {
  return [...pocket, ...systemVoices].map((voice) => ({
    id: voiceId(voice),
    label: voiceLabel(voice),
    lang: voice.lang,
  }));
}

// A Pocket TTS voice of the language first, then the system default.
export function pickDefaultVoice(systemVoices, pocket, language) {
  const prefix = String(language ?? '')
    .slice(0, 2)
    .toLowerCase();
  const match = prefix && pocket.find((voice) => voice.lang.toLowerCase().startsWith(prefix));
  return match || systemVoices.find((voice) => voice.default) || systemVoices[0] || null;
}
