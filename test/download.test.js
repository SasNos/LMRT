import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadBytes } from '../src/download.js';

const URL = 'https://huggingface.co/x/y.onnx';
const state = { cancelled: false };
const response = (parts, ok = true) => ({
  ok,
  status: ok ? 200 : 404,
  body: {
    getReader() {
      let i = 0;
      return {
        read: async () => (i < parts.length ? { done: false, value: parts[i++] } : { done: true }),
        cancel: async () => {
          state.cancelled = true;
        },
      };
    },
  },
});

test('joins chunks and reports progress', async () => {
  const progress = [];
  const bytes = await downloadBytes({
    fetchFn: async () => response([Uint8Array.of(1, 2), Uint8Array.of(3)]),
    url: URL,
    size: 3,
    onProgress: (loaded, total) => progress.push([loaded, total]),
  });
  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.deepEqual(progress, [
    [2, 3],
    [3, 3],
  ]);
});

test('works without a progress callback', async () => {
  const bytes = await downloadBytes({ fetchFn: async () => response([Uint8Array.of(9)]), url: URL, size: 1 });
  assert.deepEqual([...bytes], [9]);
});

test('rejects foreign addresses, HTTP errors and oversized bodies', async () => {
  const fetchFn = async () => response([Uint8Array.of(1, 2, 3)]);
  const foreign = [
    'http://huggingface.co/x',
    'https://evil.example/x',
    'https://huggingface.co.evil.example/x',
    undefined,
    5,
  ];
  for (const url of foreign) {
    await assert.rejects(downloadBytes({ fetchFn, url, size: 3 }), /not allowed/);
  }
  await assert.rejects(downloadBytes({ fetchFn: async () => response([], false), url: URL, size: 3 }), /404/);
  await assert.rejects(downloadBytes({ fetchFn, url: URL, size: 2 }), /larger than expected/);
  assert.equal(state.cancelled, true);
});
