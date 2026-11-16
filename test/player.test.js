import test from 'node:test';
import assert from 'node:assert/strict';
import { clampRate, createPlayer } from '../src/player.js';

function setup(texts = ['a', 'b', 'c'], pauses = []) {
  const spoken = [];
  const calls = [];
  const states = [];
  const synth = {
    speak: (u) => spoken.push(u),
    cancel: () => calls.push('cancel'),
    pause: () => calls.push('pause'),
    resume: () => calls.push('resume'),
  };
  const timers = [];
  const schedule = (fn, ms) => {
    const timer = { fn, ms, cancelled: false };
    timers.push(timer);
    return () => {
      timer.cancelled = true;
    };
  };
  const player = createPlayer({
    synth,
    createUtterance: (text) => ({ text }),
    onState: (s) => states.push(s),
    schedule,
  });
  player.load(
    texts.map((text, i) => ({ text, blockIndex: i, ...(pauses[i] === undefined ? {} : { pause: pauses[i] }) })),
  );
  return { player, spoken, calls, states, timers, last: () => states.at(-1) };
}

test('clampRate bounds and sanitises', () => {
  assert.equal(clampRate(0), 0.5);
  assert.equal(clampRate(10), 3);
  assert.equal(clampRate('1.5'), 1.5);
  assert.equal(clampRate('x'), 1);
});

test('plays all chunks in order, then returns to idle', () => {
  const { player, spoken, last } = setup();
  player.play();
  assert.equal(spoken[0].text, 'a');
  spoken[0].onend();
  spoken[1].onend();
  assert.equal(spoken[2].text, 'c');
  assert.equal(last().status, 'playing');
  spoken[2].onend();
  assert.equal(last().status, 'idle');
  assert.equal(last().index, 0);
});

test('pause and resume; wrong-state calls do nothing', () => {
  const { player, calls, last } = setup();
  player.pause();
  player.resume();
  assert.equal(last().status, 'idle');
  player.play();
  player.pause();
  assert.equal(last().status, 'paused');
  player.play();
  assert.equal(last().status, 'playing');
  assert.deepEqual(
    calls.filter((c) => c !== 'cancel'),
    ['pause', 'resume'],
  );
});

test('stale events from cancelled utterances are ignored', () => {
  const { player, spoken, last } = setup();
  player.play();
  player.play(2);
  spoken[0].onend();
  spoken[0].onerror();
  assert.equal(last().index, 2);
  assert.equal(last().status, 'playing');
});

test('speech error stops playback', () => {
  const { player, spoken, last } = setup();
  player.play();
  spoken[0].onerror();
  assert.equal(last().status, 'idle');
});

test('stop resets; load of nothing makes play a no-op', () => {
  const { player, spoken, last } = setup();
  player.play(1);
  player.stop();
  assert.equal(last().index, 0);
  assert.equal(last().status, 'idle');
  const empty = setup([]);
  empty.player.play();
  assert.equal(empty.spoken.length, 0);
  assert.equal(spoken.length, 1);
});

test('play clamps its start index', () => {
  const { player, spoken } = setup();
  player.play(99);
  assert.equal(spoken[0].text, 'c');
  player.play(-5);
  assert.equal(spoken[1].text, 'a');
});

test('seek moves while idle and jumps while playing, within bounds', () => {
  const { player, spoken, last } = setup();
  player.seek(1);
  assert.equal(last().index, 1);
  assert.equal(last().status, 'idle');
  player.seek(-9);
  assert.equal(last().index, 0);
  player.play();
  player.seek(1);
  assert.equal(spoken.at(-1).text, 'b');
  player.seek(99);
  assert.equal(spoken.at(-1).text, 'c');
  const empty = setup([]);
  empty.player.seek(1);
  assert.equal(empty.last().index, 0);
});

test('rate and voice apply to the next utterance and restart a playing one', () => {
  const { player, spoken } = setup();
  player.setRate(2);
  player.setVoice({ voiceURI: 'v' });
  assert.equal(spoken.length, 0);
  player.play();
  assert.equal(spoken[0].rate, 2);
  assert.equal(spoken[0].voice.voiceURI, 'v');
  player.setRate(99);
  assert.equal(spoken[1].rate, 3);
  player.setVoice(null);
  assert.equal(spoken[2].voice, undefined);
});

test('createUtterance receives the voice; the next chunk is prefetched when the synth supports it', () => {
  const prefetched = [];
  const created = [];
  const synth = { speak() {}, cancel() {}, pause() {}, resume() {}, prefetch: (next) => prefetched.push(next) };
  const player = createPlayer({
    synth,
    createUtterance: (text, voice) => (created.push([text, voice]), {}),
    onState() {},
    schedule: () => () => {},
  });
  player.load([{ text: 'a' }, { text: 'b' }]);
  player.setVoice({ id: 'v', neural: true });
  player.setRate(2);
  player.play();
  assert.deepEqual(created[0], ['a', { id: 'v', neural: true }]);
  assert.deepEqual(prefetched, [{ text: 'b', voice: { id: 'v', neural: true }, rate: 2 }]);
  player.play(1);
  assert.equal(prefetched.length, 1, 'no prefetch after the last chunk');
});

test('a pause after a chunk delays the next one, scaled by the rate', () => {
  const { player, spoken, timers } = setup(['a', 'b'], [400]);
  player.setRate(2);
  player.play();
  spoken[0].onend();
  assert.equal(spoken.length, 1);
  assert.equal(timers[0].ms, 200);
  timers[0].fn();
  assert.equal(spoken[1].text, 'b');
});

test('pausing during the wait holds the next chunk until resume, without touching the speech engine', () => {
  const { player, spoken, timers, calls, last } = setup(['a', 'b'], [400]);
  player.play();
  spoken[0].onend();
  const before = calls.length;
  player.pause();
  assert.equal(timers[0].cancelled, true);
  assert.equal(last().status, 'paused');
  assert.equal(spoken.length, 1);
  player.resume();
  assert.equal(spoken[1].text, 'b');
  assert.deepEqual(
    calls.slice(before).filter((c) => c !== 'cancel'),
    [],
  );
});

test('stop during the wait cancels the timer', () => {
  const { player, spoken, timers, last } = setup(['a', 'b'], [400]);
  player.play();
  spoken[0].onend();
  player.stop();
  assert.equal(timers[0].cancelled, true);
  assert.equal(last().status, 'idle');
  assert.equal(spoken.length, 1);
});

test('the last chunk never waits', () => {
  const { player, spoken, timers, last } = setup(['a'], [400]);
  player.play();
  spoken[0].onend();
  assert.equal(timers.length, 0);
  assert.equal(last().status, 'idle');
});

test('during the wait the display already shows the upcoming chunk', () => {
  const { player, spoken, last } = setup(['a', 'b', 'c'], [400, 400]);
  player.play();
  spoken[0].onend();
  assert.equal(last().index, 1);
  assert.equal(last().chunk.text, 'b');
});

test('speed or voice change during the wait does not repeat the finished chunk', () => {
  const { player, spoken, timers } = setup(['a', 'b'], [400]);
  player.play();
  spoken[0].onend();
  player.setRate(1.5);
  assert.deepEqual(
    spoken.map((u) => u.text),
    ['a', 'b'],
  );
  assert.equal(timers[0].cancelled, true);
  player.setVoice({ name: 'x' });
  assert.equal(spoken.at(-1).text, 'b');
});

test('seek during the wait is relative to the upcoming chunk', () => {
  const { player, spoken } = setup(['a', 'b', 'c', 'd'], [400, 400, 400]);
  player.play();
  spoken[0].onend();
  player.seek(1);
  assert.equal(spoken.at(-1).text, 'c');
});

test('a player without a schedule function is rejected up front', () => {
  assert.throws(() => createPlayer({ synth: {}, createUtterance: () => ({}), onState() {} }), /schedule/);
});
