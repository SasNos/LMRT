# Status (2026-11-11)
**Exists:** MV3 extension, reader page (open/drop file, play/pause/resume/stop, previous/next part, speed, voice, click-to-start, current block highlight, dark mode), Markdown to speech blocks, chunking, injectable player, settings normalisation, file checks.

**Tested:** 26 unit tests, 100% line/branch/function coverage of `src/` (enforced by `npm test`). Manually in the preview: sample.md loads, blocks parse, Play starts reading and highlights, Stop works, no console errors.

**Not tested / gaps:**
- `reader.js`, `background.js`, `scripts/make-icons.js` are thin glue and not unit-tested (documented exclusion).
- Not yet loaded as a real unpacked extension in Chrome (toolbar click opening the tab).
- Audible output, drag and drop, keyboard flow, screen reader and contrast ratios not verified. UI strings are English only (no German dictionary requested).
- No formatter/linter configured yet. No git repo yet (session had no project folder). Review skills not run as skills for lack of a diff; manual review done instead.
