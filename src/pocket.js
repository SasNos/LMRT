// Client for the native voice host (host/lmrt_tts_host.py). The host runs Pocket TTS (Kyutai, CC BY 4.0) from the
// runtime that Letter installed; Chrome starts it through Native Messaging. Everything the host sends is checked here.
export const POCKET_LANGS = { german: 'de-DE', english: 'en-US' };
// The message of a sentence that was cancelled on purpose (not a voice error).
export const CANCELLED = 'cancelled';
const VOICE_NAME = /^[a-z0-9_]{1,40}$/;
const MAX_ERROR_LENGTH = 300;
const MIN_SAMPLE_RATE = 8000;
const MAX_SAMPLE_RATE = 96000;
const INT16_SCALE = 32768;

const isId = (value) => Number.isSafeInteger(value) && value > 0;

// Base64 of little-endian 16-bit mono PCM to samples in [-1, 1).
export function pcmToFloat(base64) {
  let binary;
  try {
    binary = atob(base64);
  } catch {
    return null;
  }
  if (binary.length % 2) return null;
  const samples = new Float32Array(binary.length / 2);
  for (let i = 0; i < samples.length; i += 1) {
    const value = binary.charCodeAt(2 * i) | (binary.charCodeAt(2 * i + 1) << 8);
    samples[i] = ((value << 16) >> 16) / INT16_SCALE;
  }
  return samples;
}

// One message of the host, reduced to known fields; null for anything else.
export function parseHostMessage(message) {
  if (!message || typeof message !== 'object') return null;
  switch (message.type) {
    case 'status': {
      const voices = {};
      for (const lang of Object.keys(POCKET_LANGS)) {
        const names = message.voices?.[lang];
        voices[lang] = Array.isArray(names)
          ? names.filter((name) => typeof name === 'string' && VOICE_NAME.test(name))
          : [];
      }
      return { type: 'status', voices };
    }
    case 'chunk': {
      const { id, sr, pcm } = message;
      if (!isId(id) || !Number.isInteger(sr) || sr < MIN_SAMPLE_RATE || sr > MAX_SAMPLE_RATE) return null;
      const samples = typeof pcm === 'string' ? pcmToFloat(pcm) : null;
      return samples ? { type: 'chunk', id, sampleRate: sr, samples } : null;
    }
    case 'done':
      return isId(message.id) ? { type: 'done', id: message.id } : null;
    case 'error':
      return {
        type: 'error',
        id: isId(message.id) ? message.id : null,
        message: typeof message.message === 'string' ? message.message.slice(0, MAX_ERROR_LENGTH) : 'Voice error',
      };
    default:
      return null;
  }
}

function concat(parts) {
  const samples = new Float32Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    samples.set(part, offset);
    offset += part.length;
  }
  return samples;
}

// `connect()` returns a Native Messaging port; `reason()` tells why it closed (chrome.runtime.lastError);
// `onError(message)` hears errors that belong to no waiting sentence. The port is opened on first use and opened
// again after the host stopped.
export function createPocketClient({ connect, reason, onError }) {
  let port = null;
  let nextId = 1;
  const jobs = new Map();
  let statusWaiters = [];

  function onMessage(raw) {
    const message = parseHostMessage(raw);
    if (!message) return;
    if (message.type === 'status') {
      for (const waiter of statusWaiters) waiter.resolve(message.voices);
      statusWaiters = [];
      return;
    }
    const job = jobs.get(message.id);
    if (!job) {
      if (message.type === 'error') onError(message.message);
      return;
    }
    if (message.type === 'chunk') {
      job.parts.push(message.samples);
      job.sampleRate = message.sampleRate;
    } else {
      jobs.delete(message.id);
      if (message.type === 'done') job.resolve({ samples: concat(job.parts), sampleRate: job.sampleRate });
      else job.reject(new Error(message.message));
    }
  }

  function onDisconnect() {
    const error = new Error(reason() ?? 'The voice helper stopped');
    port = null;
    for (const job of jobs.values()) job.reject(error);
    jobs.clear();
    for (const waiter of statusWaiters) waiter.reject(error);
    statusWaiters = [];
  }

  function send(message) {
    if (!port) {
      port = connect();
      port.onMessage.addListener(onMessage);
      port.onDisconnect.addListener(onDisconnect);
    }
    port.postMessage(message);
  }

  return {
    // The installed voices per language.
    status() {
      return new Promise((resolve, reject) => {
        statusWaiters.push({ resolve, reject });
        send({ op: 'status' });
      });
    },
    // Loads the model and the voice ahead of the first sentence.
    warm(voice) {
      try {
        send({ op: 'warm', lang: voice.pocketLang, voice: voice.pocketVoice });
      } catch (error) {
        onError(error.message);
      }
    },
    // Stops every sentence that is still waiting, except the one whose promise is `keep` (the prefetched next
    // chunk); the engine skips them.
    cancelAll(keep) {
      for (const [id, job] of jobs) {
        if (job.promise === keep) continue;
        jobs.delete(id);
        job.reject(new Error(CANCELLED));
        if (port) port.postMessage({ op: 'cancel', id });
      }
    },
    // Pocket TTS has no speed setting; the reader's speed applies to the system voices.
    synthesize(text, voice) {
      const job = { parts: [], sampleRate: MIN_SAMPLE_RATE };
      job.promise = new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        Object.assign(job, { resolve, reject });
        jobs.set(id, job);
        try {
          send({ op: 'speak', id, lang: voice.pocketLang, voice: voice.pocketVoice, text });
        } catch (error) {
          jobs.delete(id);
          reject(error);
        }
      });
      return job.promise;
    },
  };
}
