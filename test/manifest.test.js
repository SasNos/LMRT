import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const manifest = read('manifest.json');
const pkg = read('package.json');
const lock = read('package-lock.json');

test('the extension asks only for Native Messaging and keeps the default script policy', () => {
  assert.deepEqual(manifest.permissions, ['nativeMessaging']);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_security_policy, undefined);
});

test('manifest and package share one version', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
});
