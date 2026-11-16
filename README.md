# LMRT

Chrome extension (Manifest V3) that reads text files aloud with the browser's built-in speech voices or with Pocket TTS. Nothing leaves the machine and no third-party code is loaded.

Supported today: `.md`, `.markdown`. New formats are added in `src/files.js` (`FORMATS`: extension to parser returning `{kind, text, speak}` blocks).

## Install (development)

1. Open `chrome://extensions`, enable Developer mode.
2. "Load unpacked" and pick this folder.
3. Click the LMRT icon, open or drop a `.md` file, press Play. Click a paragraph to start there.

## Pocket TTS voices (optional, Windows)

The browser's system voices work out of the box. For Pocket TTS, install a voice in Letter (it brings the runtime), then run `npm run install-host` once. LMRT lists the installed Pocket TTS voices; the speed setting applies to the system voices only.

Pocket TTS by Kyutai, model weights licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (https://huggingface.co/kyutai/pocket-tts-without-voice-cloning).

## Develop

```bash
npm test    # unit tests, fails below 100% line/branch/function coverage of src/
npm run check   # lint, format check and tests
npm run install-host   # registers the Pocket TTS voice host for Chrome (Windows, current user)
node scripts/make-icons.js   # regenerate icons/
```
