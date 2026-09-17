# Tasks

## 1. Failing contracts (TDD — no production code yet)

- [x] 1.1 Flip frontend contracts: fake timers so 医典/马桶 still load; no `.ll-companion` before 90s of visible sit time; at 90s a companion bubble shows non-empty cute copy (not a `<textarea>`, not `<video>`, not `wikipedia.org` `<a>`); dismiss hides it; advancing less than 8 more minutes does not show another; sit-alert overlay still exists at 5 minutes with higher z-index than the companion. Use `Array.from` (not iterator spreads). Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalemAbsence|Lalem.test'` **fails** while the companion markup is missing
- [x] 1.2 Flip Go contracts: `GET /api/v1/lalem/companion?locale=cn` (and `en`) returns 200 JSON with non-empty `text` and `angle` in `medical|biological|social|historical`; canned path when advisor has no `CompleteFn`; diagnostic snippets (`you have` / `你患有`) are rejected. Verify `cd backend && go test ./internal/ai ./internal/api -count=1` **fails** while the route is missing

## 2. Companion API

- [x] 2.1 Add `AdviseLalemCompanion` (SiliconFlow `CompleteFn`, cute/funny poop-science prompt covering the four angles, parse one line, ≥8 canned lines per locale, strip diagnosis). Wire `GET /api/v1/lalem/companion` with a **separate** rate limit from digest increment. Verify 1.2 Go tests pass and digest increment tests still pass

## 3. Lounge bubble

- [x] 3.1 Render `.ll-companion` on `/lalem`: fetch companion GET at 90s visible sit time, then every 480s; pause while hidden; dismiss until next slot; sit-alert remains the blocking overlay. i18n dismiss control. Verify 1.1 RTL passes and 拉榜/马桶/厕纸/医典 tests still pass

## 4. Isolation

- [ ] 4.1 Isolation: no officer Navigation / Fridge Raid / landing restyle, no `Notification` / `requestPermission`, no `<video>`, no `#c6a56a` / `ll-chip-track`, sit-alert 5-minute cadence unchanged, 拉榜 increment unchanged. Bump `hardDataUrls.ts` stamp. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem|catalog.test'` and `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` pass. Confirm `unset CI && cd frontend && npm run build` succeeds (no new iterator-spread TS2802)
