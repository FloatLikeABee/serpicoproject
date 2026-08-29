## Context

See `proposal.md` for motivation. Today the visual system is centralized in `frontend/tailwind.config.js` (synth/neon tokens, Orbitron/Rajdhani/Share Tech Mono, neon shadows, synth-grid) and `frontend/src/index.css` (`.synth-world`, `.game-panel`, `.btn-neon-*`, `.hud-nav`, scanlines). Almost every police/civilian screen consumes those tokens via Tailwind classes; a few files also hardcode hex. `ThemeProvider` is dark-only.

The constraint is compatibility: renaming hundreds of `neon-*` / `game-panel` classes is a functional risk. Retokenize in place.

## Goals / Non-Goals

**Goals:**

- One palette swap that restyles the whole SPA.
- Keep existing class names and component structure.
- Bright accents on deep navy; drop CRT/game HUD feel.

**Non-Goals:**

- New light mode, branding rewrite, or layout/IA changes.
- Backend or API work.
- Per-screen one-off restyles except where a hardcoded hex would otherwise stay magenta/cyan.

## Decisions

### 1. Retokenize existing names instead of renaming classes

Keep `synth.*`, `neon.*`, `game-panel`, `btn-neon-primary`, `serpico-red/blue`. Map them to police-force colors so call sites keep working.

- **Why:** Class rename across the app is the most likely way to break clicks, contrast, or missed screens.
- **Alternative considered:** Introduce `pd-*` tokens and migrate every file. Rejected for this change (scope and regression risk).

### 2. Palette (implementation tokens)

Deep-blue surfaces (replace purple void):

| Token | Role | Target |
| --- | --- | --- |
| `synth.void` | Page background | `#061428` (near-navy black-blue) |
| `synth.deep` | Header / nav / inputs | `#0a1f3d` |
| `synth.panel` | Cards / modals | `#0e2a52` |
| `synth.border` | Borders | `#1e4a7a` |
| `synth.muted` | Secondary text | `#8fb0d4` (cool, not dull grey-purple) |
| `synth.text` | Body text | `#e8f1fb` |

Bright highlights (not muted):

| Token | Role | Target |
| --- | --- | --- |
| `neon.cyan` / `serpico-blue` | Primary / focus / active nav | `#3ec6ff` (bright police-light blue) |
| `neon.blue` | Secondary highlight | `#5aa8ff` |
| `neon.amber` | Warnings / attention | `#ffc107` |
| `neon.green` | Success / go | `#3dff9a` |
| `neon.magenta` / `serpico-red` | Danger / delete | `#ff4d6d` (bright, not dull maroon; not game magenta) |
| `neon.purple` | De-emphasize as navy accent, not hero | `#2f6fd6` (steel blue, not neon purple) |

Shadows and grids: replace magenta/purple glow with navy + electric-blue glow at lower intensity (subtle highlight, not arcade bloom). Remove or zero-out `.synth-scanlines`.

### 3. Typography: swap display font, keep body

Replace Orbitron (game HUD) with a professional sans for `font-display` (e.g. **Source Sans 3** or **IBM Plex Sans**), keep a clean body (Rajdhani can stay or move to the same family). Mono can stay for codes/IDs.

- **Why:** Color alone still looks like a game if titles stay Orbitron + ultra tracking.
- **Alternative considered:** Keep Orbitron, only recolor. Rejected; user asked to stop looking like a game.

### 4. Sweep hardcoded hex only where it fights the theme

After token remap, grep `frontend/src` for leftover `#ff2bd6`, `#00f5ff`, `#7b2ff7`, `#07050f`. Replace with tokens or the new hex. Do not change JS logic that happens to sit near those styles.

### 5. Leaflet / map chrome

Do not change map tile provider or pin behavior. Overlay controls (modals, buttons on the map) pick up token changes automatically. Marker colors that encode type MAY shift to the new accent tokens if they currently use magenta/cyan, as long as types stay distinguishable.

## Risks / Trade-offs

- **[Missed hardcoded color]** → Mitigation: repo-wide hex grep before calling the change done; visual pass on Login, Fleet, Pursue, Notes, Chat, Investigation Helper.
- **[Low contrast after navy shift]** → Mitigation: muted text stays cool-blue (`#8fb0d4`), not grey; primary buttons stay bright `#3ec6ff` on dark navy.
- **[Class names still say “neon/game”]** → Trade-off accepted; names are internal. Renaming is a later cleanup.
- **[Leaflet contrast]** → Overlay text on the map must remain readable; if a control becomes invisible, bump its background token, not the map logic.

## Migration Plan

1. Land token + CSS + font changes on a feature branch; no backend deploy required for behavior, but frontend Render rebuild is required for production.
2. Rollback: revert the frontend theme files; class names are unchanged so revert is localized.
3. No data migration.

## Open Questions

None that block implementation. Exact display font (Source Sans 3 vs IBM Plex Sans) can be chosen at apply time without changing requirements.
