# Style guide (derived from `reader.css`)
Tokens live on `:root` in `reader.css`; light and dark via `prefers-color-scheme`.
- Spacing: `--space-1..4` = 4, 8, 16, 24 px. Radius `--radius` 8 px. Touch target `--target` 44 px. Text measure `--measure` 70ch.
- Colours: `--bg --surface --text --muted --accent --on-accent --highlight --border` (text 4.5:1, UI parts 3:1 intended; contrast not yet measured with a tool).
- Fonts: system stack, mono stack for code blocks. Nothing is loaded from third parties.
- Current paragraph: highlight colour plus outline (never colour alone). Focus ring 3 px accent.
