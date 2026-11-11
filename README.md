# LMRT

Chrome extension (Manifest V3) that reads text files aloud with the browser's built-in speech voices. Nothing leaves the machine and no third-party code is loaded.

Supported today: `.md`, `.markdown`. New formats are added in `src/files.js` (`FORMATS`: extension to parser returning `{kind, text, speak}` blocks).

## Install (development)
1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" and pick this folder.
3. Click the LMRT icon, open or drop a `.md` file, press Play. Click a paragraph to start there.

## Develop
```bash
npm test    # unit tests, fails below 100% line/branch/function coverage of src/
node scripts/make-icons.js   # regenerate icons/
```
