## 1. Failing contracts (TDD — no production code yet)

- [ ] 1.1 Extend `lalemAbsence.test.ts` / `Lalem.test.tsx`: `Lalem.tsx` MUST NOT contain `wikipedia.org` inside an `<a` href (or `target="_blank"` on wiki URLs); 热榜 MUST use `.ll-trend-tag` and MUST NOT render a trend `<img>` in the list; lounge CSS MUST set `image-rendering: pixelated` on `.ll-card img` and MUST still forbid `#c6a56a` / `ll-chip-track`. Verify `CI=true npx react-scripts test --watchAll=false --testPathPattern='lalemAbsence|Lalem.test'` **fails** on current `target=_blank` wiki links and hero trend images
- [ ] 1.2 Add Go tests for `GET /api/v1/lalem/wiki?url=`: allowlisted zh/en wikipedia https returns `{title,extract}` from a mocked REST summary; `example.com` / http / empty path is 4xx and the mock transport is not called; handler does not call the live model. Verify `go test ./internal/api ./internal/ai -count=1` **fails** because the route does not exist yet

## 2. Wiki summary API

- [ ] 2.1 Implement allowlist + REST summary fetch (`/api/rest_v1/page/summary/{title}`, descriptive User-Agent) behind `GET /api/v1/lalem/wiki?url=`; register on the public 拉了么 group. Verify 1.2 Go tests pass

## 3. In-app wiki reader and trend tags

- [ ] 3.1 Replace toilet/paper image `<a>` and sheet Wikipedia `<a>` with buttons that open a `role="dialog"` wiki reader (z-index 30) fed by `/lalem/wiki`; show title + extract (or lounge error copy); source URL as text not a link; 医典 Wikipedia sources use the same reader; NHS stays an ordinary https `<a>`. Verify 1.1 wiki assertions pass and existing title-opens-sheet / 厕纸 persist tests still pass
- [ ] 3.2 Restyle 热榜 to a compact `.ll-trend` row with `.ll-trend-tag` from `kind` (add i18n keys if missing); no list `<img>`; unmapped trend sheet has no 16:10 hero. Verify RTL: 热榜 has `.ll-trend-tag`, `document.querySelector('.ll-trend img')` is null, mapped trend still opens 医典 sheet, no `<video>`

## 4. Pixel sprites

- [ ] 4.1 Redraw every `frontend/public/lalem/toilets/*.svg` and `papers/*.svg` as 32×32 (or 48×32) `<rect>` pixel grids using only the design sprite palette; keep the same `imageUrl` paths; CSS `image-rendering: pixelated` and ~1:1 card image ratio. Verify `TestLalemToiletImagesHaveDistinctGeometry` / paper uniqueness still pass, lounge CSS has `pixelated`, and `lalemAbsence` still has no `#c6a56a` / `#ff4d8d` in sprites (`rg '#c6a56a|#ff4d8d' frontend/public/lalem` empty)

## 5. Isolation sweep

- [ ] 5.1 Isolation: no Wikipedia `<a>` in `Lalem.tsx`, no `#c6a56a` / `ll-chip-track`, no `Notification` / `<video>`, Fridge Raid and officer pages untouched. Verify `CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem'` and `go test ./internal/ai ./internal/api ./internal/database -count=1` pass
