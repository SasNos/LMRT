import { DEFAULT_RATE, MAX_RATE, MIN_RATE } from './constants.js';

export function clampRate(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_RATE;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, number));
}

// Plays chunks one after another. The speech API is injected so it can be faked.
// `schedule(fn, ms)` runs fn after ms and returns a function that cancels it (setTimeout in the browser).
export function createPlayer({ synth, createUtterance, onState, schedule }) {
  if (typeof schedule !== 'function') throw new TypeError('createPlayer needs a schedule function');
  let chunks = [];
  let index = 0;
  let status = 'idle';
  let generation = 0;
  let rate = DEFAULT_RATE;
  let voice = null;
  let cancelWait = null;

  const emit = () => onState({ status, index, total: chunks.length, chunk: chunks[index] ?? null });

  function clearWait() {
    cancelWait?.();
    cancelWait = null;
  }

  function speakCurrent() {
    const mine = (generation += 1);
    clearWait();
    synth.cancel();
    if (index >= chunks.length) {
      index = 0;
      status = 'idle';
      emit();
      return;
    }
    const utterance = createUtterance(chunks[index].text, voice);
    utterance.rate = rate;
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (mine !== generation) return;
      const pause = chunks[index].pause ?? 0;
      index += 1;
      if (pause > 0 && index < chunks.length) {
        // The display already shows the chunk that comes next; speed, voice and seek act on it.
        emit();
        cancelWait = schedule(speakCurrent, pause / rate);
      } else {
        speakCurrent();
      }
    };
    utterance.onerror = () => {
      if (mine !== generation) return;
      status = 'idle';
      emit();
    };
    status = 'playing';
    emit();
    synth.speak(utterance);
    const next = chunks[index + 1];
    if (next && synth.prefetch) synth.prefetch({ text: next.text, voice, rate });
  }

  return {
    load(next) {
      generation += 1;
      clearWait();
      synth.cancel();
      chunks = next;
      index = 0;
      status = 'idle';
      emit();
    },
    play(from) {
      if (status === 'paused' && from === undefined) return this.resume();
      if (from !== undefined) index = Math.min(Math.max(0, from), Math.max(0, chunks.length - 1));
      if (chunks.length) speakCurrent();
    },
    pause() {
      if (status !== 'playing') return;
      if (cancelWait) cancelWait();
      else synth.pause();
      status = 'paused';
      emit();
    },
    resume() {
      if (status !== 'paused') return;
      status = 'playing';
      if (cancelWait) speakCurrent();
      else {
        synth.resume();
        emit();
      }
    },
    stop() {
      generation += 1;
      clearWait();
      synth.cancel();
      index = 0;
      status = 'idle';
      emit();
    },
    seek(delta) {
      const target = Math.min(Math.max(0, index + delta), Math.max(0, chunks.length - 1));
      if (status === 'idle') {
        index = target;
        emit();
      } else {
        this.play(target);
      }
    },
    setRate(value) {
      rate = clampRate(value);
      if (status === 'playing') speakCurrent();
    },
    setVoice(next) {
      voice = next ?? null;
      if (status === 'playing') speakCurrent();
    },
  };
}
