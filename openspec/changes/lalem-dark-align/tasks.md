## 1. Failing contracts (TDD — no production CSS/markup yet)

- [ ] 1.1 Extend `frontend/src/lalemAbsence.test.ts` so lounge CSS (`html.ll-world` / `.ll-*` block in `index.css`) MUST define `--ll-bg`, `--ll-surface`, `--ll-text`, `--ll-muted`, `--ll-accent`, `--ll-line`, `--ll-gutter`; MUST NOT contain `#c6a56a`, `#ff4d8d` as a lounge selected/dismiss fill, `#2a1710` as the page wash, candy pink/gold `radial-gradient` on `.ll-page`, or `repeating-linear-gradient` stripe wallpaper; MUST still forbid `ll-chip-track` in `Lalem.tsx`; officer Navigation / Fridge Raid / landing still have no `/lalem`. Verify `CI=true npx react-scripts test --watchAll=false --testPathPattern=lalemAbsence` **fails** on current brown-pink CSS
- [ ] 1.2 Add RTL in `Lalem.test.tsx`: toilet filter rows use `.ll-filter-row` + `.ll-chip-label` + `.ll-chip-wrap` (labels not siblings of chips in a wrap flex); five dock buttons remain; wiki image links, 厕纸/医典 docks, no `<video>`, sit-alert still pops. Verify the new filter-row assertion **fails** on current `ChipRow` (`ll-chip-row` only)

## 2. Token sheet and calm dark chrome

- [ ] 2.1 On `html.ll-world` set the design tokens (`--ll-bg` `#12161c`, `--ll-surface` `#1b212b`, `--ll-text` `#e6ebf2`, `--ll-muted` `#9aa8b8`, `--ll-accent` `#8ec5c0`, `--ll-gutter` `1rem`, plus `--ll-line`); paint `html`, `body`, `#root`, and `.ll-page` with `var(--ll-bg)` (no stripe, no pink/gold radials); bump `.ll-page` `max-width` to ~40rem. Verify 1.1 CSS token/absence assertions pass and `grep` of `index.css` `.ll-page` has no `repeating-linear-gradient`
- [ ] 2.2 Restyle header, chips, gallery, lists, sheet, and `.is-on` to consume tokens: selected state is accent **outline + low-alpha fill**, text `--ll-text` (not hot-pink fill / brown text). Verify 1.1 still passes (`#ff4d8d` gone from lounge selected) and existing `Lalem.test.tsx` language/dock tests still pass

## 3. Filter label column

- [ ] 3.1 Change `ChipRow` in `Lalem.tsx` to `.ll-filter-row` (grid `auto 1fr`) with `.ll-chip-label` in column 1 and chips inside `.ll-chip-wrap` (flex wrap, `align-items: center`, chip `min-height: 2.25rem`). Do **not** add `ll-chip-track`. Verify 1.2 RTL passes and `lalemAbsence` still rejects `ll-chip-track`

## 4. Card grid and shared gutter

- [ ] 4.1 Make `.ll-card` a CSS grid `grid-template-rows: auto minmax(2.75rem, auto) auto` (image / title / meta); titles `-webkit-line-clamp: 2` plus `title` attribute for overflow; keep 2 equal gallery columns and shared image aspect-ratio. Verify a source/CSS contract (or RTL) that `.ll-card` includes `minmax(2.75rem` and `.ll-card` titles clamp to 2 lines; existing toilet/paper gallery tests still pass
- [ ] 4.2 Apply `padding-inline: var(--ll-gutter)` (or equivalent shared inset) on header, body, dock, and sheet so dock left/right edges match the gallery; dock stays `repeat(5, minmax(0, 1fr))` with ellipsis / slightly smaller type; wrap to two rows only below ~340px. Verify CSS contains `--ll-gutter` on those chrome rules and five dock buttons still render in `Lalem.test.tsx`

## 5. Sit-alert surfaces and isolation sweep

- [ ] 5.1 Restyle `.ll-sit-alert*` to the same type scale and tokens; escalation MAY use a deeper red **surface** without gold borders or hot-pink dismiss. Verify sit-alert RTL (5 / 10 minute, visibility wait) still pass and lounge CSS has no `#ffd36a` gold sit-alert border
- [ ] 5.2 Isolation: no `#c6a56a`, no `ll-chip-track`, no officer `Navigation` / `Notification` / `<video>`; Fridge Raid and officer pages untouched. Verify `CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem'` and `go test ./internal/ai ./internal/api ./internal/database -count=1` pass (backend unchanged)
