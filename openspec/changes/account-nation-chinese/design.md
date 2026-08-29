## Context

See `proposal.md` for motivation. Auth is mock + `localStorage` `user` (demo id `demo-serpico`). Cases (`Notes.tsx`) already has an **Account** block with logout. Fleet cities are US-only (`cities.ts`, default `olathe`). Pursue is locked to an Olathe bbox. Board/mysteries RSS and daily intel Google News use `hl=en-US&gl=US` and US queries (NamUs/FBI). `PUT /users/me` does not persist. Helper APIs take `?userId=`.

Assumptions recorded here: Simplified Chinese only (`zh-CN`); two nations `us` | `cn`; admin SPA stays English except it can trigger a China intel lane; officer-authored content is never auto-translated.

## Goals / Non-Goals

**Goals:**

- One account field `nation` that drives locale, map region, and news region.
- String catalog + `t()` so chrome is not hardcoded English.
- Region-scoped Fleet/Pursue city sets; Shanghai default for `cn`.
- Separate US vs CN news/mysteries lanes keyed by nation, requested with `userId` (and nation from the user record or query).

**Non-Goals:**

- Traditional Chinese, additional countries, or runtime machine-translation of user notes.
- Full i18n of the admin frontend.
- Real OAuth; demo login stays.
- Reviving Chase Game.

## Decisions

### 1. Nation enum on the user, control in Cases → Account

Store `nation: "us" | "cn"` on the in-memory/localStorage user and on SQLite `users.nation` (default `us`). Cases Account: segmented control or select labeled Nation / 国家.

- **Why:** User asked for the setting on Cases → Account and for it to bind to the account.
- **Alternative considered:** Device language from the browser. Rejected; would ignore the account.

### 2. Lightweight catalogs, not a new i18n framework

`frontend/src/i18n/en.ts` and `zh.ts` (or JSON) plus `useT()` from nation. Cover nav, Login (when a stored user already has nation), Fleet, Pursue, Board, Chat, Cases, Investigation Helper, pin modal. Fallback to English key if a string is missing.

- **Why:** CRA + TS already; `react-i18next` is extra weight for two locales.
- **Alternative considered:** Duplicate entire page trees. Rejected.

### 3. Pass nation to APIs as `?userId=` plus `?nation=` (CORS-safe)

Do not rely on `X-User-Id`. Chat, mysteries, intel, and map-tag AI read `nation` from query (or look up stored user nation). Default `us` if omitted.

- **Why:** Matches existing helper pattern in project context.
- **Alternative considered:** Header-only. Rejected (CORS/history).

### 4. Two intel/mysteries lanes, not one global mix

Daily intel: Google News `hl=zh-CN&gl=CN&ceid=CN:zh-Hans` and China crime queries when collecting the CN lane; keep current US lane. Persist files/rows tagged `nation=us|cn`. Mysteries refresh and list filter by nation. Board UI requests the account’s lane.

- **Why:** A single US RSS dump cannot become China news after a toggle.
- **Alternative considered:** Translate US cards with Gemini. Rejected; user asked for China crime news.

### 5. Map region packs

`FLEET_CITIES_BY_NATION`: `us` = current list; `cn` = Shanghai (default) plus other major PRC cities (Beijing, Guangzhou, Shenzhen, Chengdu, etc.). Saved city id is per `userId` **and** nation so a US Olathe save does not leak onto China Fleet. Pursue: Shanghai center/bounds when `cn` (replace Olathe lock for that nation only).

- **Why:** User required Shanghai default for Chinese.
- **Alternative considered:** Keep Olathe map with Chinese labels. Rejected.

### 6. AI language in system prompts

When `nation=cn`, prepend/require Simplified Chinese replies for chat, place-tag briefs, mysteries card generation, and intel curator. English otherwise.

## Risks / Trade-offs

- **[Incomplete string sweep]** → Mitigation: grep English chrome in `frontend/src` before done; missing keys fall back to English and fail a catalog-coverage test for known nav keys.
- **[CN Google News RSS sparse or blocked]** → Mitigation: CN query set + Gemini structuring; fallback copy in Chinese that states sources were thin, not silent US cards.
- **[Pursue Shanghai roads]** → Mitigation: reuse OSM fetch pattern with a Shanghai bbox; if road graph fails, still show the city map for pins.
- **[SQLite users row vs mock login]** → Mitigation: always write nation to localStorage user; upsert `users` by id when the API is up so it survives deploys with disk.

## Migration Plan

Default existing accounts to `us` (no behavior change). Frontend + backend deploy together so `nation` query is understood. Rollback: omit nation (servers default `us`).

## Open Questions

None that block the spec. Further countries can be another change.
