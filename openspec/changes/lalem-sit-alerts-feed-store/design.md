## Context

See `proposal.md` for motivation and `specs/lalem-page/spec.md` plus `specs/lalem-loo-feed/spec.md` for behavior.

`/lalem` already has a session sit timer (`Date.now()` minus a mount `started` ref, 1s tick) and a header line 「已坐 mm:ss」. `GET /api/v1/lalem/digest` currently rate-limits every request, calls `AdviseLalemDigest` on miss, and keeps a 1-hour in-memory map. Parse caps a generation at 8 trends / 6 useful. SQLite already lives on Render disk `DATA_DIR` (`serpico.db`). `SetupRoutes` already receives `*database.Database`. Curated videos and trend images stay local packs. Same SiliconFlow live text path as Fridge Raid. No officer nav.

Self-grill (locked, not open questions):

- **OS notifications / `Notification.requestPermission`?** No. Mobile Safari will nag or ignore; the user asked for a pop-out on the page. In-page `role="dialog"` overlay only.
- **Persist sit duration in the DB?** No. Timer is this visit’s gag, not a bowel log. Spec forbids a health record.
- **Server-pushed alerts (SSE/websocket)?** No. The clock is client session time. Extra protocol for a bathroom joke.
- **Postgres or a new Render disk?** No. Existing SQLite on `DATA_DIR` is the durable store. App-container files are ephemeral; RAM-only is what we are leaving.
- **Replace the whole digest every day?** No. User said keep the data. Append ~2 trends + 1 useful per Shanghai day; prune older than 3 calendar months.
- **90 days vs 3 calendar months?** Three calendar months (`AddDate(0, -3, 0)` in Asia/Shanghai). Matches “max 3 month” without inventing a 90-day product rule.
- **New Render cron service for the daily increment?** No. Free web spin-down would miss ticks anyway. Lazy increment on digest GET when that locale’s last increment date is before today Shanghai.
- **Scrape Douyin / Weibo for “real” trends?** Still no (same as `lalem-toilet-lounge`).
- **Store videos in SQLite?** No. Keep `LalemCuratedVideos()` on compose. User asked to keep trends and useful stuff.
- **Cap GET at 8 cards?** No. Archive newest-first inside the 3-month window. One locale is ~2 trends/day × ~90 days ≈ 180 cards — fine as JSON.
- **Share fridge-raid rate limit?** No. Keep the `lalem` bucket, but charge it only when seed/increment would call the live model.
- **Officer nav / rename Fridge Raid / luxury CSS from PR #104?** No. This change branches from `main`. Do not mix the unmerged espresso restyle.

## Goals / Non-Goals

**Goals:**

- Escalating in-page sit alerts every 5 minutes of lounge session time.
- SQLite archive of trends + useful notes, daily keep-and-append, 3-month prune.
- Digest GET is a store read; live model only for seed/increment.
- Isolation: officer chat, Fridge Raid, toilet catalog, local media pack unchanged.

**Non-Goals:**

- Accounts, OS notifications, medical logging, social scrape, a third Render service, storing videos, pagination UI, Traditional Chinese, mixing the unmerged luxury-theme PR.

## Decisions

### 1. Client overlay on the existing session timer

Keep `started` as mount time. On the existing 1s tick, `milestone = floor(elapsedSeconds / 300)`. When `milestone >= 1` and the document is visible, show a single `role="dialog"` overlay for that milestone (or the latest due if several passed while hidden). Track `dismissedMilestone`. Dismiss (button, backdrop, Escape) sets it to the current milestone so the overlay stays down until `milestone` increases. If an earlier dialog is still open when a later milestone hits, replace it (do not stack).

Drama tiers (CSS + distinct i18n keys), clamped at 30+ minutes as the top tier:

| Elapsed | Class (names may match closely) | Tone |
| --- | --- | --- |
| 5m | `ll-sit-alert--t1` | Theatrical nudge |
| 10m | `ll-sit-alert--t2` | Bigger type / stronger gold flash |
| 15m | `ll-sit-alert--t3` | Shake / full-bleed veil |
| 20m | `ll-sit-alert--t4` | Louder copy, larger dialog |
| 25m | `ll-sit-alert--t5` | Near-curtain |
| 30m+ | `ll-sit-alert--t6` | Maximum drama, still dismissible |

Copy MUST include the elapsed minutes. Default muted; no new SFX in this change. No `Notification` usage in source.

- **Why:** Matches “every 5 minutes… the longer the more dramatic” on the timer we already tick.
- **Alternative considered:** `setTimeout` chain from mount. Worse with background tabs; the 1s clock already exists.
- **Alternative considered:** Persist last-alert in `localStorage`. Rejected — new visit starts a new sit.

### 2. SQLite tables on `DATA_DIR`, not RAM

Add tables in `createTables` (names may match closely):

- `lalem_trends`: `id`, `locale`, `kind`, `title`, `hook`, `image_url`, `chips_json`, `created_at`; unique `(locale, title)` so daily dupes skip.
- `lalem_useful`: `id`, `locale`, `body`, `created_at`; unique `(locale, body)`.
- `lalem_feed_meta`: `locale` PK, `last_increment_date` (`YYYY-MM-DD` Shanghai), optional `last_generated_at` RFC3339.

Index `(locale, created_at DESC)` on both item tables. Use the existing `*sql.DB` from `database.Database`. Tests against `:memory:` like invites/hardware.

- **Why:** User asked to keep data in a DB so 热榜 is fast; Render already mounts SQLite on disk.
- **Alternative considered:** Badger as source of truth. Rejected — Badger is the cache; SQLite is the durable pattern.
- **Alternative considered:** JSON file under `frontend/public`. Lost on deploy; not a DB.

### 3. Digest GET compose path

`handleLalemDigest(c, db, aiService)`:

1. Prune rows with `created_at` older than now minus 3 calendar months (Shanghai).
2. Load trends + useful for locale, newest first.
3. If no rows → **seed**: rate-limit, then `AdviseLalemDigest` (existing full prompt), insert all mapped trends/useful, set `last_increment_date` to today Shanghai. On 429/error with empty store, keep current canned fallback **and still insert it** so the next GET is a store hit.
4. Else if `last_increment_date < today Shanghai` → **increment**: rate-limit, then a small advisor call for **2 trends + 1 useful**, map images like today, insert (ignore unique conflicts), bump `last_increment_date`. On failure, return existing rows (do not delete, do not bump the date so a later GET can retry).
5. Compose `LalemDigest` from DB + `LalemCuratedVideos()` + disclaimer. `generatedAt` is the latest stored `created_at` (or now on seed).
6. Optional ~60s in-memory wrap of the **composed** JSON only; never the only copy.

Do **not** call `lalemAllowed` on warm store-only GETs. Handler tests that 429 after eight plain GETs MUST change: 429 only when seed/increment would run.

Wire `db` in `routes.go`. If `db` is nil in a unit test, keep a degraded path: current RAM behavior is unacceptable for prod, but tests that only stub the adviser should pass a memory SQLite.

- **Why:** First visitor of the day pays for two cards; everyone else is a SQLite read. Fast, keep-the-data, no extra service.
- **Alternative considered:** Always regenerate 8 cards and upsert. Rejected — that is not “slowly updating everyday for a couple new stuff.”
- **Alternative considered:** Background goroutine ticker. Dies on spin-down; GET-lazy is enough.

### 4. Increment prompt vs full seed

Keep `BuildLalemDigestPrompt` for empty-store seed (today’s 娱乐-then-时尚 JSON, cap 8/6). Add an increment prompt: JSON only, **exactly two** entertainment/fashion trends and **exactly one** useful note, same medical bans, no invented image URLs, locale-faithful. Reuse `ParseLalemDigest` then take `trends[:2]` and first useful string. Image pairing stays server-side pool mapping. Same `generateWithLiveModel` / no vision.

- **Why:** Seed fills the museum-of-the-feed on day one; later days stay a couple of new cards.
- **Alternative considered:** Increment-only forever. First 热榜 would look empty-ish until weeks pass.

### 5. Frontend archive list

`Lalem.tsx` already maps `digest.trends` / `digest.useful` in order. Keep that; backend sends newest first. No pagination widget in this change. Sit alert is a page-level overlay (works on 马桶 too, not only 热榜). i18n keys under `lalem.sitAlert*` (CN default). RTL: fake timers to 5:00 → one `role="dialog"`; dismiss; 9:59 still gone; 10:00 new copy + stronger class; `visibilitychange` hidden skips paint.

- **Why:** Spec is newest-first archive plus overlay on the existing page.
- **Alternative considered:** Alert only on 热榜. Rejected — they are sitting even on 马桶.

## Risks / Trade-offs

- **[First GET of the day is slow]** Seed/increment still hits SiliconFlow → Mitigation: only once per locale per Shanghai day; warm GETs skip the limiter; canned seed on failure still persists.
- **[SQLite write on a public GET]** Unique constraints + single connection pool already used → Mitigation: short transaction; ignore dup titles; prune before insert.
- **[180 trend cards on a phone]** Scroll list, not a virtualizer in v1 → Mitigation: 3-month cap; revisit pagination only if this is janky.
- **[429 on empty store]** First visitor of a cold locale can be limited → Mitigation: persist canned seed so the store warms; document tests around generation-only limiting.
- **[Sit alert annoying]** That is the feature → Mitigation: one dialog, dismiss until next 5 minutes, no sound, no OS permission.
- **[Model medical creep on increment]** Same prompt bans + useful is a short tip → Mitigation: reuse existing strip/canned rules if present.

## Migration Plan

Additive tables on existing SQLite; no user migration. Empty tables seed on first digest GET. Rollback: revert handlers/page; leftover tables are unused. No new Render env vars, disks, or cron. Do not archive `lalem-toilet-lounge` in this change.

## Open Questions

None that block apply. Overlay is in-page. Store is SQLite on `DATA_DIR`. Daily increment is lazy on GET. Retention is 3 calendar months. Videos stay curated files.
