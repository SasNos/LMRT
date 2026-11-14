import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { HOST_NAME, extensionIdFromDigest, hostManifest } from '../src/native-host.js';

test('the extension id follows from the manifest key the way Chrome computes it', () => {
  assert.equal(extensionIdFromDigest('0123456789abcdef'.repeat(4)), 'abcdefghijklmnopabcdefghijklmnop');
  const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  const digest = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex');
  assert.equal(extensionIdFromDigest(digest), 'mgjcikhmlbjjcokjlmllldoiclliadoi');
});

test('anything but a hex digest is refused', () => {
  for (const value of [undefined, '', 'xyz', 'ABCDEF'.repeat(6), '0123'.repeat(7)]) {
    assert.throws(() => extensionIdFromDigest(value), /SHA-256/);
  }
});

test('the host manifest allows only this extension', () => {
  assert.deepEqual(hostManifest('C:\\host\\lmrt_tts_host.bat', 'mgjcikhmlbjjcokjlmllldoiclliadoi'), {
    name: HOST_NAME,
    description: 'LMRT read-aloud voices (Pocket TTS)',
    path: 'C:\\host\\lmrt_tts_host.bat',
    type: 'stdio',
    allowed_origins: ['chrome-extension://mgjcikhmlbjjcokjlmllldoiclliadoi/'],
  });
  for (const id of ['', '*', 'chrome-extension://x/', 'z'.repeat(32), 'a'.repeat(31)]) {
    assert.throws(() => hostManifest('x', id), /extension id/);
  }
});
