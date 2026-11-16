// Speech API for neural voices: same shape as speechSynthesis (speak, cancel, pause, resume).
// `synthesize(text, voice, speed)` resolves to { samples, sampleRate }; `audio` plays them. The prefetch is keyed by
// voice, speed and text.
import { trimSilence } from './trim.js';

// `abort(keep)` (optional) stops the engine's work for chunks that are no longer wanted, except the promise `keep`.
export function createNeuralSynth({ synthesize, audio, abort }) {
  let generation = 0;
  let handle = null;
  let cached = null;
  let paused = false;
  let held = null;

  // Trimmed as soon as the chunk is ready, so a prefetched chunk pays for it while the previous one plays.
  const trimmed = (raw) => raw.then((data) => ({ ...data, samples: trimSilence(data.samples, data.sampleRate) }));
  const key = (text, voice, speed) => `${voice.id}|${speed}|${text}`;
  const start = (text, voice, speed) => {
    const k = key(text, voice, speed);
    if (cached?.key === k) {
      const { promise } = cached;
      cached = null;
      return promise;
    }
    // A jump to another chunk: the prefetched one is not needed any more.
    if (cached) abort?.();
    cached = null;
    return trimmed(synthesize(text, voice, speed));
  };

  return {
    speak(utterance) {
      const mine = (generation += 1);
      const begin = ({ samples, sampleRate }) => {
        handle = audio.play(samples, sampleRate, () => {
          if (mine !== generation) return;
          handle = null;
          utterance.onend();
        });
      };
      start(utterance.text, utterance.voice, utterance.rate)
        .then((audioData) => {
          if (mine !== generation) return;
          // Paused while still synthesizing: hold the chunk back until resume.
          if (paused) held = () => begin(audioData);
          else begin(audioData);
        })
        .catch(() => {
          if (mine === generation) utterance.onerror();
        });
    },
    cancel() {
      generation += 1;
      // The player cancels before every chunk; the prefetched next chunk stays wanted.
      abort?.(cached?.raw);
      held = null;
      paused = false;
      handle?.stop();
      handle = null;
      audio.resume();
    },
    pause() {
      paused = true;
      audio.pause();
    },
    resume() {
      paused = false;
      audio.resume();
      const release = held;
      held = null;
      release?.();
    },
    // Synthesizes the next chunk while the current one plays, so there is no gap.
    prefetch({ text, voice, rate }) {
      const raw = synthesize(text, voice, rate);
      const promise = trimmed(raw);
      promise.catch(() => {});
      cached = { key: key(text, voice, rate), promise, raw };
    },
  };
}
