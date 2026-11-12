import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouterSynth } from '../src/router-synth.js';

function setup() {
  const log = [];
  const make = (name) => ({
    speak: (u) => log.push(`${name}:speak:${u.text}`),
    cancel: () => log.push(`${name}:cancel`),
    pause: () => log.push(`${name}:pause`),
    resume: () => log.push(`${name}:resume`),
    prefetch: (n) => log.push(`${name}:prefetch:${n.text}`),
  });
  return { log, router: createRouterSynth({ system: make('system'), neural: make('neural') }) };
}

test('routes by the voice of the utterance; pause and resume follow the active one', () => {
  const { log, router } = setup();
  router.speak({ text: 'a', voice: { neural: true } });
  router.pause();
  router.resume();
  router.speak({ text: 'b', voice: null });
  router.speak({ text: 'c' });
  router.pause();
  assert.deepEqual(log, [
    'neural:speak:a',
    'neural:pause',
    'neural:resume',
    'system:speak:b',
    'system:speak:c',
    'system:pause',
  ]);
});

test('cancel stops both; prefetch only for neural voices', () => {
  const { log, router } = setup();
  router.cancel();
  router.prefetch({ text: 'x', voice: { neural: true } });
  router.prefetch({ text: 'y', voice: null });
  assert.deepEqual(log, ['system:cancel', 'neural:cancel', 'neural:prefetch:x']);
});
