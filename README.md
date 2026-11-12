# LMRT

Chrome extension (Manifest V3) that reads text files aloud with the browser's built-in speech voices. Nothing leaves the machine and no third-party code is loaded.

Supported today: `.md`, `.markdown`. New formats are added in `src/files.js` (`FORMATS`: extension to parser returning `{kind, text, speak}` blocks).

## Install (development)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" and pick this folder.
3. Click the LMRT icon, open or drop a `.md` file, press Play. Click a paragraph to start there.

## Neural voices (optional)

The browser's system voices work out of the box. For better ones: `npm ci`, then `npm run build` once. In LMRT choose a voice marked "neural" and click "Install voice". German: Piper (Thorsten, Ramona, Kerstin). English and others: Piper or Kokoro (Kokoro needs a GPU with WebGPU). The download (63-326 MB, only from huggingface.co, checked against a pinned SHA-256) is stored in the browser profile; "Remove voice" deletes it.

## Develop

```bash
npm test    # unit tests, fails below 100% line/branch/function coverage of src/
npm run check   # lint, format check and tests
npm run build   # bundles the neural engines into dist/
npm run pin     # re-pins voice downloads (about 1 GB download)
node scripts/make-icons.js   # regenerate icons/
```
