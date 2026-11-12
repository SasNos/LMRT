import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_PREFIX } from '../src/download.js';
import { KOKORO_MODEL_ID, kokoroFilesFor, kokoroSizeFiles, kokoroUrl } from '../src/kokoro.js';

const base = `https://huggingface.co/${KOKORO_MODEL_ID}/resolve/main`;

test('a voice needs the shared model files plus its own voice file, all pinned', () => {
  const files = kokoroFilesFor('af_heart');
  assert.deepEqual(
    files.map((f) => f.path),
    ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'onnx/model.onnx', 'voices/af_heart.bin'],
  );
  for (const file of files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.ok(file.size > 0);
    assert.ok(kokoroUrl(file).startsWith(ALLOWED_PREFIX));
  }
  assert.equal(kokoroUrl(files[3]), `${base}/onnx/model.onnx`);
});

test('unknown or hostile voice names are rejected', () => {
  for (const name of ['nobody', '', 'toString', '__proto__', undefined, 5]) {
    assert.throws(() => kokoroFilesFor(name), /Unknown Kokoro voice/);
  }
});

test('kokoroSizeFiles names the model and the voice', () => {
  const { model, voice } = kokoroSizeFiles('af_heart');
  assert.equal(model.path, 'onnx/model.onnx');
  assert.equal(voice.path, 'voices/af_heart.bin');
});
