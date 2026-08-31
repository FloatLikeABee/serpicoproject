## Why

Login and first-session chrome still default to United States (or the last nation stored on this device) even when the officer is opening the app from China. Nation should be pre-selected from **access area** so China visitors land in China mode without opening Cases → Account, and everyone else lands in United States mode.

## What Changes

- On each visit, infer access area from the browser environment: **China area → China mode (`cn`); any other area → United States (`us`)**. “Origin” here means geographic access area, not the HTTP `Origin` header.
- Use that inference to paint **Login** chrome and to set the account nation when this `userId` has **no stored nation yet**.
- Once the officer explicitly chooses United States or China on Cases → Account, that stored choice **wins** over geo for later sessions of the same account.
- Do not treat browser language alone as area (a US officer with a zh-CN browser must stay United States unless they are in a China area or they pick China on Account).

## Capabilities

### New Capabilities

- `geo-nation-default`: Detect whether the current browser access area is China; pre-select China vs United States mode for login and for accounts that have not yet stored a nation; keep explicit Account nation as the override.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs; `account-nation` still lives as a change delta. This change adds geo **defaulting**; Account United States / China remains the explicit control.)

## Impact

- Frontend: `frontend/src/utils/nation.ts` (detect + distinguish unset vs stored), `Login.tsx` (stop using last-nation as the login locale), `AuthContext.tsx` (apply geo when this account has no nation yet). Tests in `nation.test.ts`.
- Backend: optional unauthenticated `GET` helper that returns `cn` when a trusted country header is present (e.g. `CF-IPCountry`); otherwise timezone-only detection on the client is enough. Existing `?userId=` / `?nation=` helpers and SQLite `users.nation` stay.
- No Chase Game revival. Demo login remains `serpico` / `cops123`.
