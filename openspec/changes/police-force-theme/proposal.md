## Why

Serpico’s current UI reads as a synthwave/arcade game: magenta-cyan neon, CRT scanlines, Orbitron display type, and purple glow panels. Target users are police, detectives, social workers, and other investigators who need a serious field tool, not a game HUD. A dark deep-blue police-force theme with brighter accent highlights will make the product look legitimate without changing how anything works.

## What Changes

- Replace the synth/neon visual system (void/purple backgrounds, magenta/cyan neon, scanline overlay, game-panel glow) with a **dark deep-blue police theme**.
- Keep accent colors **bright and high-contrast** for primary actions, focus, alerts, and status — not muted or muddy.
- Soften game-like chrome (heavy glow, CRT scanlines, sci-fi display font) so chrome feels like an operations app.
- Keep **all existing class names and component APIs** (`game-panel`, `neon-*`, `synth-*`, `btn-neon-primary`, etc.) so screens do not need behavior rewrites; tokens and CSS behind those names change.
- **No functional changes**: routing, auth, maps, chat, Fleet/Pursue notes, AI, persistence, and layouts stay the same.

## Capabilities

### New Capabilities

- `ui-visual-theme`: Visual identity for the investigator-facing app — dark deep-blue surfaces, bright accent highlights, reduced game chrome, and a no-regression rule that theming must not change behavior.

### Modified Capabilities

- None (no existing specs under `openspec/specs/`).

## Impact

- Frontend only: `frontend/tailwind.config.js`, `frontend/src/index.css`, `frontend/public/index.html` (font loading), shared chrome classes used across police/civilian pages.
- No backend, API, or data-model changes.
- Leaflet map tiles and pin logic stay; only overlay chrome colors may follow the new tokens.
- Light/dawn theme remains unused (`ThemeProvider` is dark-only); do not reintroduce a light mode in this change.
