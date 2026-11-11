# Style guide

The look is Anime Link Finder's (user, 2026-11-11). All values are variables on `:root` in `reader.css`, light and dark; rules never contain hex or rgb.

- Colours: `--bg --fg --muted --accent --on-accent --border --surface --highlight`.
- Spacing (4 px grid): `--space-1..5` = 4, 8, 12, 16, 24. Type: `--fs-1..3` = 14, 16, 20. Radius `--radius-1` 6. Control height `--h-control` 40 (at least 32). Text width `--measure` 70ch.
- Fonts: system stack (`--font`, `--font-mono`), self-hosted nothing needed, nothing loaded from third parties. Weights 400, 600, 700.
- Focus ring and current paragraph use 2 px accent outlines; the current paragraph also gets a background, so it is never colour alone.
