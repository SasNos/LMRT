import test from 'node:test';
import assert from 'node:assert/strict';
import { createNeuralSynth } from '../src/neural-synth.js';
import { trimSilence } from '../src/trim.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup() {
  const synthesized = [];
  const events = [];
  const plays = [];
  const synthesize = (text, voice, speed) => {
    synthesized.push([text, voice.id, speed]);
    return text === 'bad'
      ? Promise.reject(new Error('x'))
      : Promise.resolve({ samples: new Float32Array(2), sampleRate: 8 });
  };
  const audio = {
    play: (samples, rate, onended) => (plays.push({ samples, rate, onended }), { stop: () => events.push('stop') }),
    pause: () => events.push('pause'),
    resume: () => events.push('resume'),
  };
  const synth = createNeuralSynth({ synthesize, audio });
  const utterance = (text) => ({
    text,
    voice: { id: 'v' },
    rate: 1,
    onend: () => events.push(`end:${text}`),
    onerror: () => events.push(`error:${text}`),
  });
  return { synth, synthesized, events, plays, utterance };
}

test('speaks an utterance and reports the end', async () => {
  const { synth, plays, events, utterance } = setup();
  synth.speak(utterance('a'));
  await tick();
  assert.equal(plays[0].rate, 8);
  plays[0].onended();
  assert.deepEqual(events, ['end:a']);
});

test('synthesis failure reports an error', async () => {
  const { synth, events, utterance } = setup();
  synth.speak(utterance('bad'));
  await tick();
  assert.deepEqual(events, ['error:bad']);
});

test('cancel stops playback and silences stale callbacks', async () => {
  const { synth, plays, events, utterance } = setup();
  synth.speak(utterance('a'));
  await tick();
  synth.cancel();
  plays[0].onended();
  assert.deepEqual(events, ['stop', 'resume']);
});

test('a cancelled or replaced utterance never plays and its error is ignored', async () => {
  const { synth, plays, events, utterance } = setup();
  synth.speak(utterance('bad'));
  synth.cancel();
  await tick();
  synth.speak(utterance('b'));
  synth.speak(utterance('c'));
  await tick();
  assert.equal(plays.length, 1);
  assert.deepEqual(events, ['resume']);
});

test('cancel without anything playing only resumes the audio', () => {
  const { synth, events } = setup();
  synth.cancel();
  assert.deepEqual(events, ['resume']);
});

test('pause and resume go to the audio', () => {
  const { synth, events } = setup();
  synth.pause();
  synth.resume();
  assert.deepEqual(events, ['pause', 'resume']);
});

test('a prefetched chunk is used once; other requests synthesize fresh', async () => {
  const { synth, synthesized, utterance } = setup();
  synth.prefetch({ text: 'bad', voice: { id: 'v' }, rate: 1 });
  synth.prefetch({ text: 'n', voice: { id: 'v' }, rate: 1 });
  synth.speak(utterance('n'));
  synth.speak(utterance('n'));
  await tick();
  assert.deepEqual(
    synthesized.map((s) => s[0]),
    ['bad', 'n', 'n'],
  );
});

test('an error thrown while starting playback is reported, not lost', async () => {
  const { events, utterance } = setup();
  const failing = createNeuralSynth({
    synthesize: () => Promise.resolve({ samples: new Float32Array(1), sampleRate: 8 }),
    audio: {
      play: () => {
        throw new Error('no audio');
      },
      pause: () => {},
      resume: () => {},
    },
  });
  failing.speak({ ...utterance('a'), onerror: () => events.push('error:a') });
  await tick();
  assert.deepEqual(events, ['error:a']);
});

test('pause while a chunk is still being synthesized holds it back until resume', async () => {
  const { synth, plays, events, utterance } = setup();
  synth.speak(utterance('a'));
  synth.pause();
  await tick();
  assert.equal(plays.length, 0);
  synth.resume();
  assert.equal(plays.length, 1);
  assert.deepEqual(events, ['pause', 'resume']);
});

test('cancel clears a pending pause', async () => {
  const { synth, plays, utterance } = setup();
  synth.speak(utterance('a'));
  synth.pause();
  synth.cancel();
  synth.speak(utterance('b'));
  await tick();
  assert.equal(plays.length, 1);
});

test('leading and trailing silence of a synthesized chunk is trimmed before it plays', async () => {
  const padded = new Float32Array(1000);
  padded.fill(0.5, 400, 500);
  const plays = [];
  const synth = createNeuralSynth({
    synthesize: () => Promise.resolve({ samples: padded, sampleRate: 1000 }),
    audio: { play: (samples) => (plays.push(samples), { stop() {} }), pause() {}, resume() {} },
  });
  synth.speak({ text: 'a', voice: { id: 'v' }, rate: 1, onend() {}, onerror() {} });
  await tick();
  assert.deepEqual(plays[0], trimSilence(padded, 1000));
  assert.ok(plays[0].length < padded.length);
});
