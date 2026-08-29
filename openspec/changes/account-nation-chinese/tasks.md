## 1. Account nation persistence

- [x] 1.1 Add `nation` (`us` | `cn`, default `us`) on the localStorage user and SQLite `users` table; persist via CORS-safe `?userId=` (upsert) and verify a Go or frontend unit test keeps `cn` on the same id after reload
- [x] 1.2 Add Nation United States / China control to Cases → Account and verify switching user ids does not leak the other account’s nation

## 2. UI locale

- [x] 2.1 Add `en` / `zh-CN` string catalogs and `useT()` wired to account nation; verify nav labels swap (Fleet/Cases/etc.) in a catalog or component test
- [x] 2.2 Translate investigator chrome (Login when session exists, Fleet, Pursue, Board, Chat, Cases, Investigation Helper, pin modal, empty states); verify a grep of remaining hardcoded English chrome is empty or listed as user content
- [x] 2.3 Confirm officer-authored notes and pin names are not rewritten when nation changes (test or documented assertion on save payload)

## 3. Maps

- [x] 3.1 Split Fleet cities by nation; China pack defaults to Shanghai; city save key includes nation; verify US default stays Olathe and CN default is Shanghai
- [x] 3.2 Point Pursue at Shanghai bounds/center when nation is `cn` (OSM pattern if needed) and verify US Pursue remains Olathe

## 4. News and AI

- [x] 4.1 Add a China daily-intel / mysteries lane (CN Google News queries, Chinese curator prompts) stored separately from US; verify Board `?nation=cn` does not return US NamUs/FBI fallback cards as the primary feed
- [x] 4.2 Pass `nation` on chat, mysteries, and map-tag AI requests; verify CN prompts require Simplified Chinese replies and US stays English
- [x] 4.3 Wire Board and intel consumers to the account nation and verify toggling nation in Account refreshes the Board lane

## 5. Verification

- [x] 5.1 Run frontend and backend tests (`CI=true npm test` in `frontend`, `go test ./...` in `backend`) and confirm they pass
- [ ] 5.2 In the browser: set China on Cases → Account; confirm Chinese chrome, Fleet Shanghai, Board China-oriented cards; set United States and confirm English + Olathe; confirm a second user id does not inherit China
