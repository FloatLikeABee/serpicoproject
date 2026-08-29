## 1. Backend fallbacks

- [ ] 1.1 Nation-key `generateFallbackResponse` / interview fallback so `[nation:cn]` returns Simplified Chinese interview-coach copy (not “dispatch systems” / “pursuit tactics”) and verify a Go test fails today on that English sentence then passes
- [ ] 1.2 Nation-key `generatePlaceTagFallback` so CN does not start with “Copy that. Live model lookup is down” and verify a Go test asserts Chinese brief copy; US copy unchanged
- [ ] 1.3 Confirm `ScreenPrompt` accepts a Chinese case brief (not jibberish) and verify a Go test with a multi-sentence 简体中文 brief returns shouldProcess true
- [ ] 1.4 Confirm interview/helper/pin chat still send `?nation=` / `[nation:cn]` and verify an existing or new prompt test still requires 简体中文 on CN

## 2. Frontend chrome and errors

- [ ] 2.1 Catalog Interview Helper leftover English (Interview / General / example / chips / placeholder / welcome) and verify a catalog test that CN labels are 简体中文
- [ ] 2.2 Catalog pin-modal leftover English helper lines and chat “Heads up” / “Copy that — comms issue” wrappers; verify CN catalog keys exist
- [ ] 2.3 Wire `AIChat.tsx`, `PlaceTagModal.tsx`, and chat error paths through `t()` / `useT()` and verify no remaining hardcoded “dispatch systems” / “Create AI info from the filled name” in those files (grep)

## 3. Verification

- [ ] 3.1 Run `CI=true npm test` in `frontend` and `go test ./...` in `backend` and confirm they pass
- [ ] 3.2 In the browser on China: Interview Helper Chinese case brief does not show the English Heads up dispatch line; pin Create AI info fallback is Chinese; switch to United States and confirm English fallbacks still appear
