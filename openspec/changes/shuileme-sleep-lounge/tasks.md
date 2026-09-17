# Tasks

## 1. Failing contracts (TDD — no production page yet)

- [x] 1.1 Flip frontend contracts: public `/shuileme` mount; five `.sm-dock` buttons (床/卧/典/声/息); no `textarea`; no sit-alert after 5 minutes; bed and bedroom galleries with local imgs + filter chips; lore sheet has disclaimer and no `you have`/`你患有`; sound dock tap calls mocked `AudioContext.resume`; wind-down has `.sm-breathe` and reduced-motion static; no `<video>` / `Notification` / `wikipedia.org` `<a>` / `#c6a56a` / `ll-world` on this page. Use `Array.from` (not iterator spreads). Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='shuileme|Shuileme'` **fails** while the page is missing
- [x] 1.2 Flip Go contracts: `GET /api/v1/shuileme/beds` (≥8, local `/shuileme/` images, fill/era filters); `GET /bedrooms` (≥8); `GET /lore` (≥16 unique ids, `/shuileme/lore/` images, no diagnosis phrases); `GET /wiki` allowlist. Verify `cd backend && go test ./internal/ai ./internal/api -count=1` **fails** while the routes are missing

## 2. Catalogs, media, API

- [x] 2.1 Embed `shuileme_beds.json`, `shuileme_rooms.json`, `shuileme_lore.json` with the locked filter vocab (beds: size/fill/era; rooms: light/layout) and bilingual copy; verify catalog unit tests for floors, unique ids, local image prefixes, and lore hygiene
- [x] 2.2 Ship JPEGs under `frontend/public/shuileme/{beds,rooms,lore}/` plus `ATTRIBUTION.md` so every `imageUrl` resolves locally; verify pack files match catalog paths (no Wikimedia hotlinks)
- [x] 2.3 Wire `GET /api/v1/shuileme/beds|bedrooms|lore` and `GET /wiki` (reuse wiki allowlist helpers, do not call `/lalem/*` from the 睡了么 client). Verify 1.2 Go tests pass and existing lalem/fridge-raid tests still pass

## 3. Page, sound, wind-down

- [x] 3.1 Add i18n `shuileme.*` (title 睡了么, kicker 睡吧, docks 床/卧/典/声/息, EN counterparts) and `serpico.shuileme.lang` default **cn**; verify catalog + lang-helper tests
- [x] 3.2 Implement `Shuileme.tsx`: `html.sm-world`, quiet 已躺 clock (no modal), five docks, photo sheets with `.sm-sheet-hero` + chips, in-lounge wiki buttons, lore disclaimer. Verify 1.1 gallery/sheet/isolation RTL
- [x] 3.3 Implement `shuilemeSound.ts` (brown/pink/rain/fan buffers, tap-to-start, stop on unmount, ignore `document.hidden`); wind-down `.sm-breathe` with `prefers-reduced-motion` static. Verify sound and rest tests pass
- [x] 3.4 Register `/shuileme` in `App.tsx` outside `ProtectedRoute` and add `shuileme` to `spa-routes.js`. Verify `shuilemeAbsence`: Navigation/Login/landing/HomeGate/FridgeRaid/Lalem have no `/shuileme` or 睡了么; spa-routes lists it; CSS has `--sm-bg: #0e1218` and no `#c6a56a`

## 4. Isolation

- [x] 4.1 Isolation: no officer Navigation / Fridge Raid / 拉了么 restyle, no `Notification` / `requestPermission`, no `<video>`, no `#c6a56a` / `#ff4d8d` / `#7ee0ff` in `html.sm-world`, no sit-alert/companion/chat on this page. Bump `hardDataUrls.ts` stamp. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='shuileme|Shuileme|lalemAbsence|catalog.test'` and `cd backend && go test ./internal/ai ./internal/api -count=1` pass. Confirm `unset CI && cd frontend && npm run build` succeeds (no new iterator-spread TS2802)
