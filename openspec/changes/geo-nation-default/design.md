## Context

See `proposal.md` for motivation and `specs/geo-nation-default/spec.md` for behavior.

Today `DEFAULT_NATION` is `'us'`. `parseNation` / `loadNation` treat a **missing** localStorage key as `us`, and `persistUser` always writes that value, so every completed login stores United States even when the officer never opened Account. Login paints chrome with `loadLastNation()`, so a prior US session on the same device hides China-area visitors. `AuthContext` hydrates demo login with `loadNation(DEMO_USER_ID)` and may apply `GET /users/me` nation on top.

Constraints: two nations `us` | `cn` already; Cases → Account remains the explicit control; helper APIs stay `?userId=` plus `?nation=`; demo `serpico` / `cops123`; no Chase Game revival; Render frontend is a static CRA build (login must work before the API answers).

## Goals / Non-Goals

**Goals:**

- Classify mainland China vs everyone else from the **browser’s IANA time zone** (sync, no extra service).
- Paint Login from that classification on this visit.
- Apply it as account nation only while the officer has not explicitly chosen nation on Account.
- Distinguish “never chosen on Account” from “chose United States” so auto-persisted `us` does not block geo.

**Non-Goals:**

- GeoIP databases, ipapi/ipinfo, or a required backend `/geo/nation` in this change (optional `CF-IPCountry` can wait).
- Using `navigator.language` / `Accept-Language` as area.
- Treating Hong Kong, Macau, or Taiwan as China mode.
- Changing catalog strings, maps, or AI beyond using the existing nation field.
- Per-request geo after the officer has an explicit Account nation.

## Decisions

### 1. Time zone is the access-area signal (not HTTP Origin, not language)

`detectAccessNation()` reads `Intl.DateTimeFormat().resolvedOptions().timeZone` (injectable in tests). Mainland China IANA zones → `cn`:

- `Asia/Shanghai` (current PRC civil zone)
- `Asia/Urumqi` (Xinjiang)
- Legacy aliases if seen: `Asia/Chongqing`, `Asia/Harbin`, `Asia/Kashgar`, `PRC`

Anything else, missing `Intl`, or thrown errors → `us`. Do **not** treat `Asia/Hong_Kong`, `Asia/Macau`, or `Asia/Taipei` as China.

- **Why:** Matches “area” on the device, works on the static Login page with no network, and is not the CORS `Origin` header. China uses a small, stable IANA set.
- **Alternative considered:** IP country via MaxMind or a public geo API. Rejected for v1 — extra dependency, often blocked from PRC, and login would flash English while waiting.
- **Alternative considered:** `navigator.language === 'zh-CN'`. Rejected; spec forbids language-as-area.
- **Alternative considered:** `GET /geo/nation` using `CF-IPCountry`. Deferred; Render does not always send that header. Time zone is sufficient to implement the spec.

### 2. Login ignores last-nation

`Login.tsx` SHALL call `detectAccessNation()` (not `loadLastNation()`) for `t(nation, …)` and `document.documentElement.lang` on the login route. Last-nation may still be written on logout for other callers, but it MUST NOT drive Login chrome.

- **Why:** Spec requires this visit’s area, including on a shared device that last used the other mode.
- **Alternative considered:** Geo only when last-nation is missing. Rejected; a stored US last-nation would keep China visitors on English Login.

### 3. Explicit Account flag; auto-saved `us` is not explicit

Add `hasExplicitNation(userId)` / `saveExplicitNation(userId, nation)` keyed separately from the nation value (e.g. `serpico.account.nation.explicit.v1.${userId}`), set **only** from `setNation` (Cases → Account).

Resolution after login:

1. If explicit flag is set → `loadNation(userId)` (Account wins, including explicit `us` over a China time zone).
2. Else → `detectAccessNation()`, then `saveNation` (without setting the explicit flag) so Fleet/maps/AI match immediately.

**Migration:** Existing localStorage `cn` without a flag SHALL be treated as explicit (historically only Account wrote `cn`). Existing `us` without a flag SHALL be treated as unset so geo can run — that `us` was the old default, not a confirmed Account choice.

- **Why:** Without a flag, `persistUser` has already written `us` for every past login, so geo would never fire for returning demo users — the bug we are fixing.
- **Alternative considered:** Treat any existing key as frozen. Rejected; demo `serpico` would stay United States forever on devices that already logged in.
- **Alternative considered:** Re-detect even after Account. Rejected; would fight the Account United States / China control.

### 4. Do not let `GET /users/me` clobber a geo default

`users.nation` defaults to `us` in SQLite. Geo login used to `PUT` that column too, so a China-area demo visit wrote `cn` on the shared `demo-serpico` row and the next US-area browser inherited it.

Rules:

- `upsertNation` only when the **explicit Account flag** is set (Cases → Account). Geo stays on the device.
- Apply remote nation only when that same flag is set. Do **not** treat remote `cn` as always-authoritative; leftover geo upserts and the column default are indistinguishable from Account without the flag.

- **Why:** Spec: first login from outside China with no stored nation is United States. Shared demo id plus geo-upsert made remote `cn` a false Account signal.
- **Alternative considered:** Apply remote `cn` always because it cannot be a column default. Rejected after implement; geo `PUT` made that false.

### 5. Tests stay in `nation.ts` (pure functions)

Export `detectAccessNation(timeZone?: string)` and `resolveSessionNation(userId, opts)` so Jest can pass `Asia/Shanghai` / `America/Chicago` / `Asia/Hong_Kong` without stubbing `Intl` globally. Keep CORS helpers on `?userId=` / `?nation=`. No new npm deps.

## Risks / Trade-offs

- **[VPN / spoofed time zone]** → Mitigation: accept it; v1 has no GeoIP. Officers can still set Account. Document in this design, not in UI.
- **[Xinjiang devices on `Asia/Urumqi`]** → Mitigation: include that zone in the China set.
- **[Hong Kong / Taiwan visitors get United States mode]** → Mitigation: required by spec (else-all-America, and we have no Traditional Chinese catalog).
- **[Existing `cn` without flag stays China even in the US]** → Mitigation: intended grandfather; they can switch Account to United States.
- **[Login lang vs post-login nation]** → Mitigation: after explicit Account, Login is still geo (unauthenticated) and the shell switches on login; that is specified.

## Migration Plan

Frontend-only deploy is enough. Old clients keep last-nation Login until this ships. Rollback: revert the frontend; nation keys remain valid `us`|`cn`. No SQLite migration.

## Open Questions

None. Hong Kong / Macau / Taiwan, language-not-area, and Account-wins are resolved in the spec.
