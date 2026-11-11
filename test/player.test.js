import test from 'node:test';
import assert from 'node:assert/strict';
import { clampRate, createPlayer } from '../src/player.js';

function setup(texts = ['a', 'b', 'c']) {
  const spoken = [];
  const calls = [];
  const states = [];
  const synth = {
    speak: (u) => spoken.push(u),
    cancel: () => calls.push('cancel'),
    pause: () => calls.push('pause'),
    resume: () => calls.push('resume'),
  };
  const player = createPlayer({ synth, createUtterance: (text) => ({ text }), onState: (s) => states.push(s) });
  player.load(texts.map((text, i) => ({ text, blockIndex: i })));
  return { player, spoken, calls, states, last: () => states.at(-1) };
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
