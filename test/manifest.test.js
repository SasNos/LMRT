import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'));
const manifest = read('manifest.json');
const pkg = read('package.json');
const lock = read('package-lock.json');

test('extension pages may compile WebAssembly but not run eval or remote scripts', () => {
  const csp = manifest.content_security_policy.extension_pages;
  const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'));
  assert.deepEqual(scriptSrc.trim().split(/\s+/).slice(1), ["'self'", "'wasm-unsafe-eval'"]);
  assert.doesNotMatch(csp, /'unsafe-eval'|https?:/);
});

test('manifest and package share one version', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
});
