import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEURAL_VOICES,
  buildVoiceOptions,
  isAvailable,
  pickDefaultVoice,
  piperUrls,
  resolveVoice,
  voiceId,
  voiceLabel,
  voiceSize,
} from '../src/voices.js';
import { ALLOWED_PREFIX } from '../src/download.js';

const system = [
  { voiceURI: 'sys-en', name: 'Sys En', lang: 'en-US', default: false },
  { voiceURI: 'sys-de', name: 'Sys De', lang: 'de-DE', default: true },
];
const thorsten = NEURAL_VOICES.find((v) => v.id === 'piper:de_DE-thorsten-medium');

test('every Piper voice is pinned and downloads only from the allowed host', () => {
  const piper = NEURAL_VOICES.filter((v) => v.engine === 'piper');
  assert.ok(piper.length > 0);
  for (const voice of piper) {
    assert.match(voice.files.onnx.sha256, /^[0-9a-f]{64}$/);
    assert.match(voice.files.json.sha256, /^[0-9a-f]{64}$/);
    assert.ok(piperUrls(voice).onnx.startsWith(ALLOWED_PREFIX));
    assert.ok(piperUrls(voice).json.endsWith('.onnx.json'));
  }
});

test('voiceSize sums the files', () => {
  assert.equal(voiceSize(thorsten), thorsten.files.onnx.size + thorsten.files.json.size);
});

test('resolveVoice finds neural voices, system voices, or nothing', () => {
  assert.equal(resolveVoice(thorsten.id, system), thorsten);
  assert.equal(resolveVoice('sys-en', system), system[0]);
  assert.equal(resolveVoice('gone', system), null);
  assert.equal(resolveVoice('', []), null);
});

test('voiceId and voiceLabel describe both kinds', () => {
  assert.equal(voiceId(thorsten), thorsten.id);
  assert.equal(voiceId(system[0]), 'sys-en');
  assert.equal(voiceLabel(system[0], new Set()), 'Sys En (en-US, system)');
  assert.match(voiceLabel(thorsten, new Set()), /neural, download \d+ MB/);
  assert.match(voiceLabel(thorsten, new Set([thorsten.id])), /neural, installed/);
});

test('buildVoiceOptions lists installed neural voices first, then the rest, then system voices', () => {
  const last = NEURAL_VOICES.at(-1);
  const options = buildVoiceOptions(system, new Set([last.id]));
  assert.equal(options[0].id, last.id);
  assert.equal(options.length, NEURAL_VOICES.length + system.length);
  assert.deepEqual(
    options.slice(-2).map((o) => o.id),
    ['sys-en', 'sys-de'],
  );
  assert.equal(options[0].voice, last);
});

test('pickDefaultVoice prefers an installed neural voice of the language', () => {
  assert.equal(pickDefaultVoice(system, new Set([thorsten.id]), 'de-DE'), thorsten);
  assert.equal(pickDefaultVoice(system, new Set([thorsten.id]), 'en-US'), system[1]);
  assert.equal(pickDefaultVoice(system, new Set(), 'de'), system[1]);
  assert.equal(pickDefaultVoice([system[0]], new Set(), undefined), system[0]);
  assert.equal(pickDefaultVoice([], new Set(), 'de'), null);
});

test('Kokoro voices are sized by the shared model plus their own file', () => {
  const kokoro = NEURAL_VOICES.filter((v) => v.engine === 'kokoro');
  assert.ok(kokoro.length > 0);
  for (const voice of kokoro) {
    assert.equal(voice.id, `kokoro:${voice.kokoroVoice}`);
    assert.equal(voiceSize(voice), voice.files.model.size + voice.files.voice.size);
  }
});

test('Kokoro is only available with WebGPU', () => {
  const heart = NEURAL_VOICES.find((v) => v.id === 'kokoro:af_heart');
  assert.equal(isAvailable(heart, true), true);
  assert.equal(isAvailable(heart, false), false);
  assert.equal(isAvailable(thorsten, false), true);
  assert.equal(resolveVoice(heart.id, system, true), heart);
  assert.equal(resolveVoice(heart.id, system, false), null);
  assert.equal(resolveVoice(thorsten.id, system, false), thorsten);
  assert.equal(
    buildVoiceOptions(system, new Set(), false).some((o) => o.id === heart.id),
    false,
  );
  assert.equal(
    buildVoiceOptions(system, new Set()).some((o) => o.id === heart.id),
    true,
  );
});
