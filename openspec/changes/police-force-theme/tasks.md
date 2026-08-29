## 1. Token remap

- [x] 1.1 Update `frontend/tailwind.config.js` synth/neon/serpico colors, shadows, and synth-grid to the navy + bright-accent tokens in design.md; verify `npx tailwindcss` / frontend build still resolves those class names (`synth-void`, `neon-cyan`, `game-panel`, etc.)
- [x] 1.2 Update `frontend/src/index.css` html/body/panel/button/nav/grid colors and glow to the same tokens; disable `.synth-scanlines` overlay; verify scanline overlay is gone in the browser and panels still use `game-panel` / `hud-nav` classes

## 2. Typography

- [x] 2.1 Replace Orbitron in `frontend/public/index.html` and `tailwind.config.js` `font-display` with a professional sans (Source Sans 3 or IBM Plex Sans); verify headings no longer load Orbitron and layout does not overflow

## 3. Hardcoded leftovers

- [x] 3.1 Grep `frontend/src` for leftover synthwave hex (`#ff2bd6`, `#00f5ff`, `#7b2ff7`, `#07050f`, similar) and retarget to tokens; verify no behavior files change except styles

## 4. Visual + functional verification

- [x] 4.1 Exercise login, Fleet map pin + notes, Pursue notes, chat, Investigation Helper, and bottom nav in the browser; verify colors are dark deep blue with bright highlights and that save/create/navigate/chat still work
- [x] 4.2 Check desktop and a mobile viewport on at least login, Fleet, and nav; verify controls remain tappable and text remains readable
