import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPin, sha256Hex } from '../src/verify.js';

const bytes = new TextEncoder().encode('abc');
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test('sha256Hex matches the known digest', async () => {
  assert.equal(await sha256Hex(bytes), ABC);
});

test('matchesPin needs the exact size and hash', async () => {
  assert.equal(await matchesPin(bytes, { size: 3, sha256: ABC }), true);
  assert.equal(await matchesPin(bytes, { size: 4, sha256: ABC }), false);
  assert.equal(await matchesPin(bytes, { size: 3, sha256: ABC.replace('b', 'c') }), false);
});

test('matchesPin rejects garbage', async () => {
  for (const [data, pin] of [
    ['abc', { size: 3, sha256: ABC }],
    [bytes, null],
    [bytes, { size: 3, sha256: 'xyz' }],
    [bytes, { size: 3, sha256: ABC.toUpperCase() }],
  ]) {
    assert.equal(await matchesPin(data, pin), false);
  }
});
