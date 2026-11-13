# Status

## 13 November 2026: pauses and trimmed silence (0.3.0)

- The reader now sets the pauses itself: 200 ms between the sentences of one block, after the end of a block 700 ms (heading), 450 ms (paragraph, quote) or 250 ms (list item, table row); divided by the speed. Pieces cut out of a long sentence get no pause, the last chunk never waits. During a pause the display already shows the next chunk, so speed, voice and seek act on it; Pause and Stop work during a pause (`schedule` is injected into the player, `setTimeout` in `reader.js`).
- Measured with the real Thorsten medium model in Node (onnxruntime-web, the project's own phonemizer and mapping): every Piper chunk carries about 0.23-0.26 s of silence on both sides, so the gap between two sentences was already about 0.5 s. `src/trim.js` now cuts samples below 1 % of the peak and keeps 30 ms on each side (verified on real output: 30 ms left). Pitch (autocorrelation, 40 ms frames) of Thorsten medium: mean 117-131 Hz, standard deviation 16-29 Hz, p10-p90 about 91-170 Hz; the noise settings 0.3, 0.5, 0.667 and 0.8 changed none of that clearly, so the melody is mostly the voice itself.
- The chunking change of 0.2.1 (cut only at . ! ? and the ellipsis, long sentences at a comma) was never committed on its own and ships in this version.
- Left on purpose: the pauses also apply to system voices, which keep their own silence on top (the constants are tuned on Thorsten medium); `schedule` stays a required option of the player.
- Tested: new tests for pauses (player, chunker) and `trim`, `npm run check` (75 tests, 100 %), `npm run build`. Not tested: how the pauses sound in Chrome, other voices than Thorsten medium in the probe.

## 12 November 2026: chunking for a natural melody (0.2.1)

- User feedback: the neural voices sound unpleasant in stress and melody. Chunks no longer end at colons and semicolons (only at . ! ? and the ellipsis), and a sentence longer than `MAX_CHUNK_LENGTH` is cut at a comma in its second half before any other space. The Piper phoneme mapping was compared with the phonemizer's own ids for Thorsten medium: identical for a single sentence.
- Tested: two new chunker tests (red first), `npm run check` (65 tests, 100 %), `npm run build`. Not tested: whether this is audibly better; `code-review`, `simplify` and `security-review` not yet run for this small change (run with the next batch). Other likely causes not yet tried: Piper noise and length settings, other voices, pauses at headings and list items.

## 12 November 2026: review fixes (0.2.0)

- Pause while a chunk is still being synthesized now holds the audio until resume; an error thrown while starting playback reaches `onerror`; the stand-in for an uninstalled neural voice follows its language; Kokoro no longer needs `shader-f16` (it runs fp32) and `env.allowRemoteModels` is off, so a cache miss cannot fetch unpinned files; `remainingBytes` errors are caught.
- Tested: three new `neural-synth` tests (red first). Not tested: Kokoro with `allowRemoteModels` off in Chrome, Kokoro on a GPU without `shader-f16`.
- Simplify: removed the unused `isKokoroUrl`/`isKokoroModelUrl` and their tests; the version test also covers `package-lock.json`; `engines/store.js` opens its cache in one helper. Left on purpose (open work 4-6, plus engine registry, shared size helper, prefetch cancellation, cached lookups in `opfs-cache.js`): `engines/install.js` logic (shared model refcount) has no unit test; download buffers the 326 MB model twice; the phonemizer module is created per chunk and removed voices keep their ONNX session until reload.

## 12 November 2026: Piper phoneme table (0.2.0)

- Piper failed with `Gather ... indices element out of data bounds`: the phonemizer's own `phoneme_ids` follow a built-in table, but each voice has its own `phoneme_id_map` (for example 130 symbols). The engine now takes the phoneme list and maps it with the voice's table (`phonemeIds`: start, pad, each known phoneme plus pad, end; unknown phonemes skipped). `parsePiperConfig` rejects a missing or malformed table and ids outside `num_symbols`.
- Tested: new unit tests (voice-specific table, unknown and prototype-like phonemes, malformed tables), `npm run check` (62 tests, 100 %), `npm run build`. The real phonemizer output was read in Node (phoneme list present).
- Not tested: running a Piper voice in Chrome after this fix (user test pending); other voices than the one that failed.

## 11 November 2026: CSP fix for WebAssembly (0.2.0)

- First real Chrome load failed: the default extension CSP (`script-src 'self'`) blocked onnxruntime's WebAssembly. `manifest.json` now sets `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'` (no `unsafe-eval`, no remote scripts). Version raised to 0.2.0 in manifest and package.
- Tested: `test/manifest.test.js` (red first, then green; CSP content and equal versions), `npm run check` (60 tests, 100 % coverage), `npm run build`.
- Not tested: the voice list and playback in real Chrome after this fix (user test pending); further blocked features may show up the same way.

## 11 November 2026: neural voices (Piper, Kokoro)

- New engines next to the system voices, chosen in the voice list: **Piper** (German: Thorsten medium/high, Ramona, Kerstin; English: Lessac, Alan; 63-114 MB each) and **Kokoro-82M** (8 voices, English, French, Spanish, Italian; shared 326 MB model; only offered with WebGPU). Voices are installed on the user's click ("Install voice") and removed with "Remove voice". The next chunk is synthesized while the current one plays.
- Every downloaded file must match a pinned size and SHA-256 (`scripts/pin-voices.js` writes `src/piper-voices.json` and `src/kokoro-pins.json`); downloads are only allowed from `https://huggingface.co/`. Piper files live in the Cache API, the Kokoro model in the origin private file system (the Cache API refuses entries above about 256 MB).
- Heavy code is bundled by `npm run build` into `dist/` (gitignored): `piper.js`, `kokoro.js` and the runtime files in `dist/vendor/` (onnxruntime-web, espeak-ng phonemizer). It is loaded only when a neural voice speaks. Run `npm run build` after `npm ci` and after every change in `engines/`.
- Measured in the preview server (Chrome pane, RTX GPU): Piper Thorsten medium 3 s of speech in 0.5-2.4 s (first call includes loading), output not silent (rms 0.056, no NaN). Kokoro on WebGPU/fp32: 2.8 s and 4.6 s of speech in 0.5 and 0.6 s, no NaN. Kokoro on the CPU (WASM, q8) took 5.6 s for 2.8 s of speech, so it is not offered without WebGPU. Kokoro fp16 on WebGPU returned NaN samples, so fp32 is used.
- Tested: `npm run check` (58 tests, 100 % line, branch and function coverage of `src/`). New pure modules: `neural-synth`, `router-synth`, `voices`, `piper-input`, `download`, `verify`, `kokoro`. Negative tests: foreign download hosts, oversized bodies, wrong hashes, garbage phonemizer output and voice configs, prototype-like voice names.
- Coverage exclusions (browser bindings that cannot run in `node --test`, each file says so in its header): `reader.js`, `background.js`, `engines/*.js`, `scripts/*`.
- Not tested: audible quality (only waveform statistics), loading as a real unpacked extension (CSP, `chrome-extension://` origin for the Hugging Face downloads, WebGPU in an extension page), machines without WebGPU, a download interrupted half way, running out of storage, Kokoro voices other than Heart, Piper voices other than Thorsten medium.

## 11 November 2026: first version, moved into Spark

- Built LMRT 0.1.0: reader tab with open/drop file, play, pause, resume, stop, previous/next part, speed, voice, click a paragraph to start there, highlight of the current block, light and dark. Markdown to reading blocks (headings, paragraphs, lists, quotes, tables; code blocks shown but not spoken; front matter skipped), chunking, injectable player, settings normalisation, file checks.
- Moved to `Tools\Spark\Extensions\LMRT` and brought to the Spark standards: ESLint, Prettier, `.editorconfig`, `CLAUDE.md`; look from Anime Link Finder (`reader.css` uses variables only).
- Tested: `npm run check` (26 tests, 100 % line, branch and function coverage of `src/`). In the preview server: sample file loads, Play reads and highlights, Stop works, no console errors.
- Fixed on the way: a table ended by a blank line swallowed the next paragraph, and escaped characters (`\*`) kept their backslash. Both have tests.
- Not tested: `reader.js` and `background.js` (thin DOM and browser glue, no unit tests; exclusion), `scripts/make-icons.js`; loading in real Chrome, audible output, drag and drop, keyboard flow, screen reader, measured contrast.

## Open work

1. Load the unpacked extension in Chrome (after `npm run build`) and listen to a real file with each engine.
2. More formats (`.txt`, `.html`, `.json`, ...): one parser each in `src/`, registered in `FORMATS`.
3. Keyboard shortcuts (space, arrows) and a language filter for the voice list; pick the voice from the language of the file.
4. Move the pure parts of `engines/install.js` into `src/` with tests.
5. Stream downloads into a preallocated buffer (peak memory of the Kokoro model).
6. Reuse the phonemizer module between chunks; drop the ONNX session of a removed voice.
7. Spark integration: not decided; LMRT has no `spark.json` (it is a page tool, not a content script).
