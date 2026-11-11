# LMRT (let me read this) – notes for Claude

Chrome-only extension (MV3), plain ES modules, no build step. Reads text files aloud with the browser's own speech voices. See [README.md](README.md) and [docs/STATUS.md](docs/STATUS.md).

## User rules (global)

- Everything in the repository is English; chat with the user is German.
- Commit the previous task when the next one arrives, named paths only. Push at most once per day and repository, never version tags, nothing for macOS. The remote `SasNos/LMRT` is public (user, 2026-11-11); a push still needs a go when the permission check asks for it.
- 100 % line, branch and function coverage of `src/` (`npm test` enforces it; `npm run check` adds ESLint and the Prettier check); bug fix = failing test first; negative tests for everything from outside (files, stored settings).
- Report honestly what was tested and what not.

## Decisions

- Name LMRT, repository `SasNos/LMRT`, folder `Tools\Spark\Extensions\LMRT` (user, 2026-11-11). Works as a Chrome extension; it opens its own reader tab (no permissions, no host access).
- Starts with Markdown (`.md`, `.markdown`); every further text format is one entry in `FORMATS` in `src/files.js` (user, 2026-11-11: "for the start .md is enough").
- Look: colours, radius and fonts from Anime Link Finder (`panel.css`), as allowed by the user on 2026-11-11. Rules in `reader.css` use variables only; the values live in `:root`.
- Speech: Web Speech API (`speechSynthesis`), text spoken in short chunks (`MAX_CHUNK_LENGTH`) because engines stall on long utterances. Code blocks are shown, never spoken.

## Not verified yet

- Loading the unpacked extension in Chrome (toolbar click), audible output, drag and drop, screen reader, measured contrast.

## Shared standards of the Spark tools (2026-11-10)

This section is identical in Spark (`Tools\Spark\Browser`) and in every tool under `Tools\Spark\Extensions` (GroupRepos, Shottr, Site Restyler, Honest Ratings, Anime Link Finder). The rules above add to it; where they differ, the rules above win for this repository. A change to this section is made in all six repositories in the same session.

### Session start

1. Read this file, then `docs/STATUS.md`.
2. `git fetch origin`, then `git status -sb`. Behind only: `git pull --ff-only origin main`. Ahead and behind: merge `origin/main`, keep the behaviour of both sides, run `npm run check`, commit the merge. Never force-push, never rebase published commits, never discard local commits.
3. `npm ci` when `node_modules/` is missing or `package-lock.json` changed.
4. `graphify update .` (graph in `graphify-out/`, gitignored). Architecture and call questions: graph first (`graphify query`, `path`, `explain`), then only the lines it points to.

### Commands (same names in every repository)

| Command                                   | Does                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm test`                                | Unit tests with the coverage gate: 100 % lines, branches and functions (Vitest also statements). Fails below. |
| `npm run lint`                            | ESLint (and Stylelint where the repository has it).                                                           |
| `npm run format` / `npm run format:check` | Prettier: `printWidth` 120, `singleQuote`, `trailingComma: all`, LF.                                          |
| `npm run tokens` / `npm run tokens:check` | Style guide sync from Mber Flow (only repositories with the Mber Flow look).                                  |
| `npm run check`                           | All of the above. Must be green before every commit.                                                          |
| `npm run build`                           | Only where a build step exists. Run after every change, so the folder Chrome loads is current.                |

Spark runs the npm commands in `app/` and adds `cargo test`; it has no ESLint and Prettier yet (open work in its `docs/STATUS.md`), so its `npm run check` is typecheck, `tokens:check` and `npm test`.

### Style guide

- **Source:** Mber Flow, `D:\Dateien - Work\Eigene\Tools\Mber Web\Mber Flow` (`app/src/theme.css`, `app/src/fonts`, `docs/STYLEGUIDE.md`). It is the only source of the look of Spark, Shottr, Site Restyler and Honest Ratings. GroupRepos follows GitHub's own look (user, 2026-10-19). Anime Link Finder keeps its own look (user, 2026-11-10).
- **Never copy tokens by hand.** `npm run tokens` generates the token file and records the hashes in `tokens.source.json`. In the tools the generator is `tools/tokens.mjs` (identical in Shottr, Site Restyler and Honest Ratings; a change is copied to all three): it takes the token list from `tokens.config.json` and copies Figtree and Open Sans into `fonts/`. Spark has `app/scripts/tokens.ts` (logic in `app/src/tokenSync.ts`) and bundles the same fonts from npm (`@fontsource-variable`, `app/src/fonts.css`). Never edit a generated file. A missing token: add its name to `tokens.config.json`, run `npm run tokens`. `MBER_FLOW_DIR` overrides where Mber Flow is looked up.
- **STYLE GUIDE DRIFT** in the output of `npm run tokens` means Mber Flow changed: regenerate, check the UI in light and dark, mention it in the report.
- **Fonts:** headings (`h1`–`h3`, titles) `var(--font-1)` = Figtree, everything else `var(--font)` = Open Sans. Self-hosted only, no font CDN. UI injected into a web page may keep the system font where loading the fonts would need extra permissions; a comment says so.
- **Rules use only variables:** spacing `--space-*`, type `--fs-*`, radii `--radius-*`, heights `--h-*`, colors only as variables, never hex or rgb in rules. 4 px grid; 2 px only for hairlines and the focus ring. Hit targets at least 32 px. Light and dark always together. Font weights 400, 600, 700. A justified exception (for example offsets that follow a host page's layout) carries a comment with the reason.
- Values that have to be copied into JavaScript (UI injected into a page) get a test that compares them with the generated token file.

### Tests

- 100 % coverage of the application code (`src/` and `tools/tokens.mjs`; Spark: TypeScript and Rust). Exclusions only for bindings to disk, browser or OS that cannot run in tests: an ignore comment with the reason in the code and an entry in `docs/STATUS.md` (Spark: `docs/COVERAGE.md`).
- Every change ships with its tests. A bug gets a failing test first. Security paths (page content, URLs, messages from pages, anything from the network) get negative tests.
- Keep the repository's test folder name (`test/` or `tests/`) and test runner (Vitest or `node --test`).

### Layout and files of a tool

- The repository folder is the unpacked extension: `chrome://extensions`, Load unpacked, `Tools\Spark\Extensions\<Tool>`. `manifest.json` is at the root. Built files go to `dist/` (gitignored) and `manifest.json` points into `dist/`. Never copy built files into the root.
- Content-script tools have `spark.json` at the root (format of GroupRepos: `id`, `name`, `version`, `description`, `matches`, `css`, `js`, `start`, `runAt`, `storage`, `network`; paths relative to the root); a test keeps it equal to `manifest.json`. The Spark integration is described in `docs/SPARK.md`.
- `manifest.json`, `package.json` and `spark.json` carry the same version; raise it with every user-visible change.
- Documents: `README.md` (use, limits), `CLAUDE.md` (rules), `docs/STATUS.md` (dated entries: what changed, what was tested and how, what was not; numbered open work), `docs/SPARK.md`. Update `docs/STATUS.md` with every change of behaviour or look.
- `.gitattributes` (`* text=auto eol=lf`), `.editorconfig`, `.prettierrc.json` as above. `.gitignore` has at least `node_modules/`, `coverage/`, `dist/`, `graphify-out/`.
- Everything in the repository is English; German only in the chat (and in Spark's translation dictionary).

### Git

- One logical change per commit, named paths only (never `git add -A` or `git add .`), message in English, ending with the Co-Authored-By line of the model in use.
- Push only when the user asks, at most once per day and repository, and only to a private remote. The public remotes (GroupRepos, Shottr, Honest Ratings) may be pushed too (user, 2026-11-10). Spark is not pushed without the user's explicit go, because every push runs CI with a macOS job. Anime Link Finder has no remote. No `v*` tags, nothing that builds for macOS.

### Finishing a task

1. `npm run check` green (Spark also `cargo test`); `npm run build` where it exists.
2. Run the review skills `code-review`, `simplify` and `security-review` on the change; fix what they find (with tests) or report what was left and why.
3. Clean up, after the implementation and before the graph update: remove what the change made unused (code, exports, styles, files, helpers, dependencies), duplicate tests (the same behaviour asserted twice, also across files), tests that assert nothing that matters (only "renders", tautologies, calls made for coverage alone), invalid tests (pass for the wrong reason, assert implementation details such as CSS source text, depend on timing), tests outside the file of their subject, and build leftovers and old test builds. Check what a file is before deleting it; when unsure, keep it and report it. Code that only a removed test covered is dead: remove it too. Run `npm run check` again afterwards.
4. Update `docs/STATUS.md`, commit with named paths, `graphify update .`.
5. Report in German: what changed, what was removed, what was tested (unit tests, real Chrome, Spark, platform) and what was not.
