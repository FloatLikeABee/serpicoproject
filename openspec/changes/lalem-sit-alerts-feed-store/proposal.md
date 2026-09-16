## Why

拉了么 already shows a quiet sit timer, so people still lose track of how long they have been on the loo. They want a **dramatic pop-up every five minutes** that names the elapsed time and gets more theatrical the longer they stay. Meanwhile 热榜 and 有用 are rebuilt from an in-memory hour cache, so a restart or a new visitor pays for a live-model call and yesterday’s cards vanish. Persist those feeds in SQLite, grow them a little every day, keep at most three months, and serve reads from the store so the lounge stays fast.

## What Changes

- Add an in-page **sit-alert overlay** on `/lalem` that fires at every 5-minute sit-session boundary and escalates copy, motion, and visual intensity with elapsed time. It is a lounge gag, not a medical bowel log. One overlay at a time; dismissible.
- Persist **all 热榜 trend cards and 有用 notes** in the existing SQLite database on the Render `DATA_DIR` disk (not ephemeral app-container files, not only RAM).
- **Keep** stored rows. Each Asia/Shanghai calendar day MAY append about **two new trends** and **one new useful note** per locale. Do not replace the archive with a fresh eight-card snapshot.
- **Prune** trend and useful rows older than **three months**.
- `GET /api/v1/lalem/digest` SHALL read the stored archive first (fast). The live SiliconFlow model runs only to produce the daily increment (or a first-time seed when the store is empty).
- Toilet museum, local media pack, no social scrape, no officer-nav entrance, Fridge Raid name/path, and the same SiliconFlow key stay as they are.
- Digest JSON field names stay the same; the `trends` / `useful` arrays MAY be longer than today’s generation cap because they now represent the kept archive (newest first, ≤3 months). Not a protocol rename.

## Capabilities

### New Capabilities

- None. Reuse the live 拉了么 capabilities from `lalem-toilet-lounge` (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Escalating 5-minute sit-session alerts on the existing lounge timer, without turning the page into a health diary or using OS notification permission.
- `lalem-loo-feed`: Durable SQLite store for trends and useful notes, daily keep-and-append updates, 3-month retention, and a digest GET that is a store read rather than a fresh model snapshot.

## Impact

- Frontend: `Lalem.tsx` overlay + i18n for escalating sit copy; 热榜/有用 render the stored archive (newest first). Isolated `.ll-*` skin only. No Navigation / Login / landing links.
- Backend: SQLite tables (or equivalent rows) for lalem trends and useful notes; prune job; digest handler reads DB and lazily appends the daily increment; same `SILICONFLOW_*` live text path as Fridge Raid; rate-limit the **increment**, not cheap store reads.
- Render: no new web service and no extra disk. Use existing `DATA_DIR` SQLite. No Blueprint cron required (lazy daily increment on digest GET).
- Isolation: officer `/chat`, Fridge Raid, toilet catalog, and curated videos stay as they are. Videos remain the local pack, not a growing DB of clips.
