## Context

See `proposal.md` for motivation and `specs/lalem-page/spec.md` for behavior.

`/lalem` already has docks, wiki cards, 厕纸/医典, sit alerts, and an isolated `.ll-*` skin. Chrome today is brown `#2a1710` plus pink/gold glows, a repeating stripe wallpaper, hot-pink `.is-on`, and a flex chip row that puts labels in the wrap flow. Gallery cards are a 2-column grid but titles have no reserved height, so neighbors misalign. `html.ll-world` and `.ll-page` can disagree on background, so the column looks pasted into a void. Unmerged PR #104 is a gold restyle (`#c6a56a`, `ll-chip-track`) and MUST stay out.

Self-grill (locked, not open questions):

- **Whole Serpico / Fridge Raid restyle?** No. `/lalem` only.
- **Cherry-pick or merge PR #104?** No. User asked darker and aligned, not gold luxury. Keep `#c6a56a` and `ll-chip-track` banned in `lalemAbsence`.
- **Pitch-black OLED + neon cyan?** No. Comfortable: lifted ink surfaces, muted teal accent, body text ~WCAG AA vs surface.
- **Full-bleed desktop museum?** No. Keep a phone-first column (`max-width` ~40rem). Align it: same background as `html.ll-world`, same gutter on header/body/dock/sheet.
- **Recolor catalog SVGs?** No. Illustrations are content.
- **New Google font?** No. Keep the existing CJK-capable stack.
- **Light mode?** No.
- **Change wiki / 热榜 / 医典 behavior?** No.
- **Officer nav, OS notifications?** No.

## Goals / Non-Goals

**Goals:**

- CSS custom properties on `html.ll-world` for bg / surface / text / muted / accent / gutter.
- One gutter + grid so chrome lines up; reserved title rows; filter label column.
- Tests lock dark tokens (no `#ff4d8d` primary selected, no `#2a1710` page wash, no `#c6a56a`) and layout classes.

**Non-Goals:**

- PR #104, officer/Fridge Raid themes, SVG redraws, API changes, new docks, Traditional Chinese.

## Decisions

### 1. Token sheet on `html.ll-world`

Define `--ll-bg`, `--ll-surface`, `--ll-text`, `--ll-muted`, `--ll-accent`, `--ll-line`, `--ll-gutter` (1rem). Page, `#root`, `.ll-page`, sheet, sit-alert surfaces all consume them. Remove the pink/gold radial gradients and the repeating stripe.

- **Why:** One source of color; html and page cannot drift.
- **Alternative considered:** Tailwind lounge classes. Rejected — lounge is isolated from officer Tailwind chrome.

### 2. Markup: filter row + card grid rows

`ChipRow` becomes `.ll-filter-row` (CSS grid: `auto 1fr`) with `.ll-chip-label` in column 1 and `.ll-chip-wrap` (flex wrap, `align-items: center`, chips `min-height: 2.25rem`) in column 2. Cards: `.ll-card` CSS grid `auto minmax(2.75rem, auto) auto` (image / title / meta). Titles `-webkit-line-clamp: 2`. Dock keeps `repeat(5, minmax(0, 1fr))` with `padding-inline: var(--ll-gutter)` matching `.ll-page`.

- **Why:** Alignment is a spec requirement, not a paint job.
- **Alternative considered:** `ll-chip-track` from #104. Rejected — banned class and gold track.

### 3. Selected state is outline + tint, not hot pink

`.is-on` uses `--ll-accent` border and a low-alpha fill; text stays `--ll-text`. Sit-alert escalation may use a deeper red **surface**, still on the same type scale, without gold borders.

- **Why:** “Modern darker but comfortable.”
- **Alternative considered:** Keep `#ff4d8d`. Rejected — that is the current loud selected chip.

### 4. Tests are CSS/source contracts plus existing RTL

- `index.css` / `lalemAbsence`: no `#c6a56a`, no `#ff4d8d` as lounge selected, no stripe wallpaper, `--ll-gutter` present.
- `Lalem.test.tsx`: filter rows have `.ll-filter-row`; five dock buttons; Chinese default; sit-alert still pops; wiki/docks still work.
- Do not screenshot-diff.

## Risks / Trade-offs

- **[Five dock labels overflow at 320px]** → Mitigation: slightly smaller dock type, `overflow: hidden; text-overflow: ellipsis`; wrap to two rows only below ~340px.
- **[Accent too quiet, selected chip hard to see]** → Mitigation: 2px accent border plus fill; do not drop below ~3:1 vs unselected.
- **[Card clamp hides long English titles]** → Mitigation: two-line clamp + `title` attribute on the card title.

## Migration Plan

1. CSS + ChipRow markup in one PR to `main` (Render auto-deploy).
2. Rollback: revert the PR.

## Open Questions

None. Self-grill above is the decision list.
