import test from 'node:test';
import assert from 'node:assert/strict';
import { trimSilence } from '../src/trim.js';

const tone = (length, value = 0.5) => new Float32Array(length).fill(value);
const sampleRate = 1000;

test('removes leading and trailing silence but keeps a short margin', () => {
  const samples = new Float32Array([...new Float32Array(300), ...tone(100), ...new Float32Array(400)]);
  const trimmed = trimSilence(samples, sampleRate);
  // margin is 30 ms = 30 samples on each side
  assert.equal(trimmed.length, 100 + 30 + 30);
  assert.equal(trimmed[30], 0.5);
});

test('quiet noise below the threshold counts as silence', () => {
  const samples = new Float32Array([...tone(200, 0.002), ...tone(50), ...tone(200, -0.002)]);
  assert.equal(trimSilence(samples, sampleRate).length, 50 + 60);
});

test('the margin never reaches beyond the buffer', () => {
  const samples = new Float32Array([...tone(10), ...new Float32Array(5)]);
  assert.equal(trimSilence(samples, sampleRate).length, 15);
});

test('silent, empty or broken buffers are returned unchanged', () => {
  const silent = new Float32Array(100);
  assert.equal(trimSilence(silent, sampleRate), silent);
  const empty = new Float32Array(0);
  assert.equal(trimSilence(empty, sampleRate), empty);
  const broken = new Float32Array([NaN, NaN, NaN]);
  assert.equal(trimSilence(broken, sampleRate), broken);
});
