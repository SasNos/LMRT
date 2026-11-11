# Status

## 11 November 2026: first version, moved into Spark

- Built LMRT 0.1.0: reader tab with open/drop file, play, pause, resume, stop, previous/next part, speed, voice, click a paragraph to start there, highlight of the current block, light and dark. Markdown to reading blocks (headings, paragraphs, lists, quotes, tables; code blocks shown but not spoken; front matter skipped), chunking, injectable player, settings normalisation, file checks.
- Moved to `Tools\Spark\Extensions\LMRT` and brought to the Spark standards: ESLint, Prettier, `.editorconfig`, `CLAUDE.md`; look from Anime Link Finder (`reader.css` uses variables only).
- Tested: `npm run check` (26 tests, 100 % line, branch and function coverage of `src/`). In the preview server: sample file loads, Play reads and highlights, Stop works, no console errors.
- Fixed on the way: a table ended by a blank line swallowed the next paragraph, and escaped characters (`\*`) kept their backslash. Both have tests.
- Not tested: `reader.js` and `background.js` (thin DOM and browser glue, no unit tests; exclusion), `scripts/make-icons.js`; loading in real Chrome, audible output, drag and drop, keyboard flow, screen reader, measured contrast.

## Open work

1. Load the unpacked extension in Chrome and listen to a real file.
2. More formats (`.txt`, `.html`, `.json`, ...): one parser each in `src/`, registered in `FORMATS`.
3. Keyboard shortcuts (space, arrows) and a language filter for the voice list.
4. Spark integration: not decided; LMRT has no `spark.json` (it is a page tool, not a content script).
