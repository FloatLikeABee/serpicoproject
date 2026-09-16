## 1. Toilet catalog and media pack

- [x] 1.1 Add a curated world+history toilet JSON catalog (~24–40 items) with `title`/`titleEn`, `blurb`/`blurbEn`, `shape`, `size`, `class`, `era`, `region`, `imageUrl`, `credit`; cover sit/squat/urinal/pit/vacuum/portable plus multiple eras; verify a Go or JSON unit test that every item has an image path and that filters by shape, size, and class return only matches
- [x] 1.2 Ship local images under `frontend/public/lalem/toilets/` (and a short attribution file) so every catalog `imageUrl` resolves; illustrated cards are OK; verify the pack has one file per catalog imageUrl and no remote-only hotlinks
- [x] 1.3 Ship at least two muted looping mp4s plus poster images under `frontend/public/lalem/videos/` (licensed/CC0/original, not scraped social clips) and a small `/lalem/trends/` image pool for entertainment/fashion; verify files exist and a test or script asserts digest video `srcUrl`s point at this pack

## 2. Digest advisor and API

- [x] 2.1 Add `BuildLalemDigestPrompt` (locale, today’s date, JSON-only, 娱乐 then 时尚, ban diagnose/prescribe/cure, no invented image URLs) and a parser for digest JSON (`trends[]`, `useful[]`) with string-or-array coercion; verify prompt tests for needles (娱乐, 时尚, disclaimer) and that officer `BuildChatPrompt` still has no 拉了么 primer
- [x] 2.2 Add `AdviseLalemDigest` using the existing SiliconFlow live text client (no vision, no image upload); map `kind`/`imageHint` onto the local trend image pool; always attach curated `videos[]`; on model failure return canned CN/EN copy + the same media; verify stubbed-complete tests and a missing-live-model path that does not call vision
- [x] 2.3 Add `GET /api/v1/lalem/toilets` (optional shape/size/class/era query) and `GET /api/v1/lalem/digest?locale=`; in-memory digest cache ~1h keyed by locale; own per-IP rate limit (~8 / 10 min, not shared with fridge-raid); verify handler tests: catalog 200 with images, filter match, digest 200 fixture with ≥1 video src, 429 after burst, officer `/chat` tests still pass

## 3. 拉了么 page

- [x] 3.1 Add i18n keys for 拉了么 chrome (title 拉了么, kicker 来都来了, dock 马桶/热榜/有用, filters, disclaimer, EN toggle) under `lalem.*` with English counterparts; default lang helper `serpico.lalem.lang` opens **cn** even if `navigator.language` is `en-US`; verify catalog + lang-helper tests
- [x] 3.2 Implement `/lalem` page: isolated `.ll-page` / `html.ll-world` (not synth-grid, not `.fr-page`), sit timer, museum gallery with image cards, shape/size/class/era filters, card sheet, 热榜 image cards + playable `<video>` (muted default), 有用 notes + disclaimer, bottom lounge dock; verify RTL: fresh visit shows 拉了么 and toilet images, EN toggle, filter hides non-matches, 热榜 has a video element, 有用 has not-medical copy, no `navigation`
- [x] 3.3 Register `/lalem` in `App.tsx` outside `ProtectedRoute` and add `lalem` to `spa-routes.js`; verify `lalemAbsence` source test: Navigation, Login, landing/HomeGate have no `/lalem`, App mounts it publicly, spa-routes lists `lalem`

## 4. Isolation and verify

- [x] 4.1 Confirm Fridge Raid, officer `/chat`, and Navigation are untouched (no 拉了么 primer in `BuildChatPrompt`, fridge-raid tests still pass)
- [x] 4.2 Run 拉了么 frontend tests plus `go test ./internal/ai ./internal/api -count=1` and verify they pass
