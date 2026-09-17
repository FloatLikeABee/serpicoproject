# Tasks

## 1. Failing contracts (TDD — no production code yet)

- [ ] 1.1 Flip frontend contracts: six `.ll-dock` buttons; chat dock shows a `<textarea>` (not officer nav, not Fridge Raid); sending a message shows a funny poop reply from mock `POST /lalem/chat`; toilet/厕纸/医典/拉榜 bottom sheets each include a large `.ll-sheet-hero` img when `imageUrl` exists; no `<video>`; no `wikipedia.org` `<a>`; CSS has `--ll-fun-a` / `.ll-sheet-chip` and no `#c6a56a`. Use `Array.from` (not iterator spreads). Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalemAbsence|Lalem.test'` **fails** while chat dock and hero sheets are missing
- [ ] 1.2 Flip Go contracts: `POST /api/v1/lalem/chat` with `{locale,message}` returns 200 JSON with non-empty `reply`; canned path when advisor has no `CompleteFn`; `you have` / `你患有` rejected. Verify `cd backend && go test ./internal/ai ./internal/api -count=1` **fails** while the route is missing

## 2. Chat API

- [ ] 2.1 Add `AdviseLalemChat` (SiliconFlow `CompleteFn`, funny poop-only prompt, parse `{reply}` or prose, ≥8 canned lines per locale, strip diagnosis). Wire `POST /api/v1/lalem/chat` with a **separate** rate limit from digest and companion. Verify 1.2 Go tests pass and digest/companion tests still pass

## 3. Chat dock and colorful sheets

- [ ] 3.1 Render dock `chat` (i18n 聊 / Chat), transcript + textarea, POST on send; keep companion 90s/8min and sit-alert overlay. Verify 1.1 chat RTL passes
- [ ] 3.2 Restyle `.ll-sheet` with `.ll-sheet-hero` cover JPEG (including 拉榜 `imageUrl`), colorful chips, brighter surface. Verify toilet/paper/medicine/trend sheet tests pass and `#c6a56a` stays absent

## 4. Isolation

- [ ] 4.1 Isolation: no officer Navigation / Fridge Raid / landing restyle, no `Notification` / `requestPermission`, no `<video>`, no `#c6a56a` / `ll-chip-track`, companion and sit-alert cadence unchanged, 拉榜 increment unchanged. Bump `hardDataUrls.ts` stamp. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem|catalog.test'` and `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` pass. Confirm `unset CI && cd frontend && npm run build` succeeds (no new iterator-spread TS2802)
