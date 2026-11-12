// Bundles the heavy voice engine into dist/ and copies its runtime files. Run: npm run build
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/vendor/kokoro', { recursive: true });
await build({
  entryPoints: ['engines/piper.js', 'engines/kokoro.js'],
  outdir: 'dist',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  minify: true,
  // kokoro-js: use the Node build, which shares one copy of transformers.js with this bundle (its env is needed
  // for the file system cache). Its fs and path imports are only used on the Node path; see scripts/empty.js.
  alias: { 'fs/promises': './scripts/empty.js', path: './scripts/empty.js' },
  external: ['fs', 'crypto', 'module', 'url', 'worker_threads', 'os', 'child_process'],
});
const ort = 'node_modules/onnxruntime-web/dist';
const piper = 'node_modules/@diffusionstudio/piper-wasm/build';
for (const file of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  cpSync(`${ort}/${file}`, `dist/vendor/${file}`);
}
for (const file of ['piper_phonemize.wasm', 'piper_phonemize.data']) {
  cpSync(`${piper}/${file}`, `dist/vendor/${file}`);
}
const kokoro = 'node_modules/@huggingface/transformers/dist';
for (const file of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) {
  cpSync(`${kokoro}/${file}`, `dist/vendor/kokoro/${file}`);
}
