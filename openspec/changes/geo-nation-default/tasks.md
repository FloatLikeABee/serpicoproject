## 1. Access-area detection (TDD)

- [x] 1.1 Add failing tests in `frontend/src/utils/nation.test.ts` for `detectAccessNation`: `Asia/Shanghai` and `Asia/Urumqi` → `cn`; `America/Chicago`, `Europe/Paris`, `Asia/Hong_Kong`, `Asia/Taipei`, `Asia/Macau`, empty/unknown → `us`; verify `CI=true npx jest src/utils/nation.test.ts --watchAll=false` fails on missing export
- [x] 1.2 Implement `detectAccessNation(timeZone?: string)` in `nation.ts` using the injectable zone (default `Intl.DateTimeFormat().resolvedOptions().timeZone`) and the mainland China IANA set from design.md, and verify the tests from 1.1 pass

## 2. Explicit Account vs geo default (TDD)

- [x] 2.1 Add failing tests for `resolveSessionNation`: no storage + Shanghai → `cn`; stored `us` without explicit flag + Shanghai → `cn` (legacy default); stored `cn` without flag + Chicago → `cn` (grandfather); explicit `us` + Shanghai → `us`; explicit `cn` + Chicago → `cn`; verify the new cases fail until implemented
- [x] 2.2 Implement explicit-nation flag helpers and `resolveSessionNation(userId, opts?)` per design.md (flag key `serpico.account.nation.explicit.v1.${userId}`), and verify the tests from 2.1 pass

## 3. Wire Login and auth

- [x] 3.1 Change `Login.tsx` to use `detectAccessNation()` (not `loadLastNation`) for chrome and set `document.documentElement.lang` from that value, and verify `grep -n loadLastNation frontend/src/pages/Login.tsx` is empty
- [x] 3.2 Change demo / Google / Apple login in `AuthContext.tsx` to apply `resolveSessionNation(userId)` (and `setNation` to set the explicit flag), and verify `grep -n loadNation(DEMO_USER_ID) frontend/src/contexts/AuthContext.tsx` is empty
- [x] 3.3 Guard `usersAPI.getMe` nation merge: apply remote only when the explicit flag is set or remote is `cn`; ignore remote `us` when unset, and verify a unit test or comment-level assertion in `nation.test.ts` covers “remote us does not override geo cn without explicit flag”

## 4. Verification

- [ ] 4.1 Run `CI=true npm test` in `frontend` and confirm it passes
- [ ] 4.2 In the browser, with a mocked or OS China time zone (or by temporarily calling detect with Shanghai in a debug build if TZ cannot be changed): Login shows Simplified Chinese; after demo login without touching Account, Fleet/Cases chrome stay Chinese; choosing United States on Account switches to English and stays English after reload even if TZ is still China
- [ ] 4.3 In the browser with a United States time zone: Login is English; Account China still switches the shell to Simplified Chinese after login
