import { DEFAULT_RATE } from './constants.js';
import { clampRate } from './player.js';

// Stored settings are untrusted: reduce them to known keys and types.
export function normalizeSettings(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const isObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  return {
    rate: isObject ? clampRate(data.rate) : DEFAULT_RATE,
    voiceUri: isObject && typeof data.voiceUri === 'string' ? data.voiceUri.slice(0, 200) : '',
  };
}

export function findVoice(voices, voiceUri) {
  return voices.find((voice) => voice.voiceURI === voiceUri) ?? null;
}
