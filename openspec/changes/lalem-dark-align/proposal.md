## Why

拉了么 currently sits in a neon brown-pink column: busy stripes, gold glow, hot-pink selected chips, and a gallery whose titles wrap to different heights so cards and dock buttons do not line up. Visitors asked for a **modern darker** lounge that still feels **comfortable**, and for **alignment** — everything neat, clear, and in place.

## What Changes

- Restyle `/lalem` chrome to a **calm dark** palette (ink surfaces, quiet accent, readable type). Comfortable contrast, not OLED-black with neon.
- Put the page on a **single gutter and grid**: header, filters, cards, lists, sheet, and five-item dock share the same inset and column math so edges, baselines, and card feet align.
- Card titles and meta occupy **equal reserved rows** so a two-line title does not shove its neighbor.
- Filter rows use a **fixed label column** plus wrapping chips of one height, not a ragged mix of labels-in-the-chip-flow.
- Sit-alert overlay stays a gag but uses the same dark tokens (escalation can stay louder without gold-pink candy).
- Isolated `.ll-*` / `html.ll-world` only. **Do not** mix unmerged luxury gold from PR #104. **Do not** restyle officer Navigation, Fridge Raid, or landing.
- No API, catalog, wiki, 医典, or 热榜 behavior change.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` from the existing 拉了么 changes (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Dark comfortable visual system and strict layout alignment for the lounge shell (header, docks, galleries, lists, sheet). Sit alerts, Chinese default, wiki cards, 厕纸/医典, and no officer entrance stay as they are.

## Impact

- Frontend: `frontend/src/index.css` `.ll-*` / `html.ll-world` tokens and layout; small markup/class tweaks in `Lalem.tsx` if needed for grid rows (e.g. filter label vs chips). Tests in `Lalem.test.tsx` / `lalemAbsence.test.ts` lock isolation (`#c6a56a` still forbidden, no officer nav) plus alignment/class contracts.
- Backend, catalogs, digest, Render Blueprint: unchanged.
