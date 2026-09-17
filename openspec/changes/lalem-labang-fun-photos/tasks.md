# Tasks

## 1. Failing contracts (TDD — no production code yet)

- [x] 1.1 Flip frontend contracts in `catalog.test.ts`, `Lalem.test.tsx`, and `lalemAbsence.test.ts`: CN `lalem.dock.hot` is `拉榜` (not `热榜`), EN is `La bang` (not `Hot`); `lalem.hotEmpty` / sit-alert t4 follow 拉榜 / La bang; lounge CSS `--ll-bg` is `#22183a` (not `#12161c`), `--ll-surface` `#33285a`, `--ll-accent` `#3ee0c4`, `--ll-pop` `#ff9a62`, still no `#c6a56a` / `#ff4d8d` / `ll-chip-track`; `.ll-card img` uses `object-fit: cover` and MUST NOT set `image-rendering: pixelated`; `.ll-trend img` is `3.5rem` square; RTL opens dock **拉榜** and `document.querySelector('.ll-trend img')` is not null. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalemAbsence|Lalem.test|catalog.test'` **fails** on current 热榜 / Hot / `#12161c` / `pixelated` / missing trend `<img>`
- [x] 1.2 Replace Go SVG-geometry uniqueness with raster contracts: every toilet/paper `imageUrl` is local `.jpg` (no `://`); file exists, JPEG SOI (`FF D8`), SHA-256 unique across toilets, across papers, and papers vs toilets; no `<svg>` in those files; `LalemTrendImagePool` paths are `/lalem/trends/*.jpg`; add a rewrite helper test that `/lalem/trends/fashion-1.svg` becomes `/lalem/trends/fashion-1.jpg`. Verify `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` **fails** while catalogs and pool still point at `.svg`

## 2. i18n 拉榜

- [x] 2.1 Set `lalem.dock.hot` to 拉榜 / La bang, `lalem.hotEmpty` to 拉榜加热中… / La bang is warming up…, and sit-alert t4 (plus any other visitor-facing 热榜 dock copy) to 拉榜 / La bang. Verify catalog tests from 1.1 for those keys pass and `Lalem.test.tsx` can `getByRole('button', { name: '拉榜' })`

## 3. Fun-dark chrome and compact 拉榜 CSS

- [x] 3.1 On `html.ll-world` set the locked tokens (`--ll-bg #22183a`, `--ll-surface #33285a`, `--ll-text #fff4e8`, `--ll-muted #c9b8e0`, `--ll-accent #3ee0c4`, `--ll-pop #ff9a62`, `--ll-line` warm 16% hairline, `--ll-gutter 1rem`); keep `color-scheme: dark`; drop `--ll-px-*`; `.is-on` mint accent; `.ll-trend-tag` uses `--ll-pop`; gallery `.ll-card img` / `.ll-sheet img` `object-fit: cover`, no `pixelated`; `.ll-card.ll-trend` `grid-template-columns: 3.5rem 1fr` with `.ll-trend img` 3.5rem square `object-fit: cover`. Keep gutter / filter `display:contents` / five-column dock. Verify 1.1 CSS assertions pass and still forbid `#c6a56a` / `#ff4d8d` / `#12161c` as `--ll-bg`

## 4. Local photograph pack

- [x] 4.1 Download interesting CC0/PD/CC BY/CC BY-SA (or NASA PD) photographs for every toilet, paper, and trend-pool stem; crop to the fixture (no identifiable person on a toilet); JPEG long-edge ~960px (trends ~480px), ≲200KB; write `frontend/public/lalem/toilets|papers|trends/*.jpg`; delete the matching card SVGs; rewrite `ATTRIBUTION.md` per file (title, author, license, source URL). Verify each catalog stem has a JPEG on disk, `rg -l '<svg' frontend/public/lalem/toilets frontend/public/lalem/papers frontend/public/lalem/trends` is empty, and files are visually photographic (not 32×32 pixel rects)
- [x] 4.2 Point `lalem_toilets.json`, `lalem_papers.json`, `LalemTrendImagePool`, frontend test fixtures, and Go digest/handler fixtures at `.jpg` paths; implement SHA-256 uniqueness + JPEG magic tests from 1.2. Verify `go test ./internal/ai ./internal/api ./internal/database -count=1` uniqueness and `.jpg` assertions pass, and no catalog `imageUrl` contains `://`

## 5. 拉榜 thumbs and legacy URL rewrite

- [x] 5.1 In `Lalem.tsx` render `<img src={tr.imageUrl}>` on each `.ll-trend` row (alt empty or title) beside `.ll-trend-tag`, title, and hook; keep mapped/unmapped sheet behavior; no `<video>`; wiki image buttons unchanged. Verify RTL 1.1: 拉榜 rows have a small `.ll-trend img`, mapped trend still opens 医典/纸/马桶 sheet, `querySelector('video')` is null, no `wikipedia.org` `<a>`
- [x] 5.2 Rewrite digest compose (and increment image mapping) so stored `/lalem/trends/*.svg` becomes `/lalem/trends/*.jpg` for known stems, and unknown legacy URLs fall back to the JPEG pool. Verify the 1.2 rewrite unit test passes and a handler/store fixture that still saves `.svg` returns `.jpg` in GET JSON

## 6. Isolation sweep

- [x] 6.1 Isolation: no Wikipedia `<a>` in `Lalem.tsx`, no `#c6a56a` / `ll-chip-track`, no `Notification` / `<video>`, no runtime hotlink `imageUrl`, Fridge Raid and officer pages untouched, wiki GET tests still pass. Bump `hardDataUrls.ts` rebuild stamp so Render’s frontend path filter notices the ship. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem|catalog.test'` and `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` pass
