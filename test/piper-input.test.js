import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePhonemes, parsePiperConfig, phonemeIds, piperRunInputs } from '../src/piper-input.js';

const config = {
  espeak: { voice: 'de' },
  audio: { sample_rate: 22050 },
  inference: { noise_scale: 0.5, length_scale: 1, noise_w: 0.8 },
  speaker_id_map: {},
  num_symbols: 130,
  phoneme_id_map: { '^': [1], _: [0], $: [2], a: [3], h: [7] },
};

test('parsePhonemes accepts the phoneme list of the phonemizer', () => {
  assert.deepEqual(parsePhonemes('{"phoneme_ids":[1,0,2],"phonemes":["h","ˈ","a"]}'), ['h', 'ˈ', 'a']);
});

test('parsePhonemes rejects garbage', () => {
  const lines = [
    '',
    'not json',
    'null',
    '{}',
    '{"phonemes":[]}',
    '{"phonemes":"x"}',
    '{"phonemes":["a",1]}',
    `{"phonemes":[${'"a",'.repeat(20000)}"a"]}`,
  ];
  for (const line of lines) assert.throws(() => parsePhonemes(line), /invalid output/);
});

test('phonemeIds follows the voice table, not the phonemizer defaults', () => {
  assert.deepEqual(phonemeIds(['h', 'a'], config.phoneme_id_map), [1, 0, 7, 0, 3, 0, 2]);
  // Same phonemes, a voice with another table: the ids differ.
  assert.deepEqual(phonemeIds(['h', 'a'], { ...config.phoneme_id_map, h: [50], a: [60] }), [1, 0, 50, 0, 60, 0, 2]);
});

test('phonemeIds skips phonemes the voice does not know and supports multi-id entries', () => {
  assert.deepEqual(phonemeIds(['q', 'a'], config.phoneme_id_map), [1, 0, 3, 0, 2]);
  assert.deepEqual(phonemeIds(['x'], { ...config.phoneme_id_map, x: [8, 9] }), [1, 0, 8, 9, 0, 2]);
  assert.deepEqual(phonemeIds(['constructor', '__proto__'], config.phoneme_id_map), [1, 0, 2]);
});

test('piperRunInputs scales length by speed and detects speakers', () => {
  assert.deepEqual(piperRunInputs(config, [5], 2), { ids: [5], scales: [0.5, 0.5, 0.8], speaker: null });
  assert.equal(piperRunInputs({ ...config, speaker_id_map: { a: 0 } }, [5], 1).speaker, 0);
  assert.equal(piperRunInputs({ ...config, speaker_id_map: undefined }, [5], 1).speaker, null);
});

test('parsePiperConfig validates the voice configuration', () => {
  assert.equal(parsePiperConfig(JSON.stringify(config)).espeak.voice, 'de');
  assert.equal(parsePiperConfig(JSON.stringify({ ...config, num_symbols: undefined })).espeak.voice, 'de');
  const broken = [
    '',
    'null',
    '{}',
    JSON.stringify({ ...config, espeak: {} }),
    JSON.stringify({ ...config, audio: {} }),
    JSON.stringify({ ...config, inference: { noise_scale: 1 } }),
    JSON.stringify({ ...config, inference: { noise_scale: 'x', length_scale: 1, noise_w: 1 } }),
    JSON.stringify({ ...config, phoneme_id_map: undefined }),
    JSON.stringify({ ...config, phoneme_id_map: [] }),
    JSON.stringify({ ...config, phoneme_id_map: { ...config.phoneme_id_map, $: undefined } }),
    JSON.stringify({ ...config, phoneme_id_map: { ...config.phoneme_id_map, a: ['x'] } }),
    JSON.stringify({ ...config, phoneme_id_map: { ...config.phoneme_id_map, a: [-1] } }),
    JSON.stringify({ ...config, phoneme_id_map: { ...config.phoneme_id_map, a: [130] } }),
    JSON.stringify({ ...config, phoneme_id_map: { ...config.phoneme_id_map, a: [] } }),
  ];
  for (const text of broken) assert.throws(() => parsePiperConfig(text), /invalid/);
});
