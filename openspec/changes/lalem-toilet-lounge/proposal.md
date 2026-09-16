## Why

People already have 翻冰箱 / “吃了么” for the kitchen. They also sit down with a phone and want something equally dedicated, funny, and Chinese-first — not officer Serpico, and not a medical stool diary. **拉了么** is that loo lounge: a world toilet museum first, then hot entertainment/fashion while you sit, plus a few actually useful bathroom notes.

## What Changes

- Add a **public one-page side app** at `/lalem` named **拉了么**. It is **not** an officer-app entrance: no link in Navigation, Login, Dashboard, or the public landing. Fridge Raid stays `/fridge-raid` / 翻冰箱 (do not rename it).
- **Default language is Simplified Chinese.** English exists as a toggle, not as the first-run default. Traditional Chinese is out of scope.
- **First surface is a world toilet museum**: illustrated toilets across cultures and history, filterable by **shape**, **size**, and **class** (and era/history chips). Every toilet card **must** show an image.
- A **热榜** surface for recent-feeling entertainment and fashion (images on every card, plus a **hot video** row you can actually play). A **有用** surface for short bathroom-useful notes (etiquette, don’t strain, wash hands, sitting-too-long nudge) — wellness framing only, not diagnosis.
- Isolated **super-fun** visual skin (comic loo lounge, one-thumb bathroom UX, silly session timer and copy). Officer synth/police chrome MUST NOT wrap this page.
- Dedicated backend feed (catalog + daily digest), rate-limited, no accounts, no poop photos from users.

## Capabilities

### New Capabilities

- `lalem-page`: Unlisted Chinese-default 拉了么 lounge at `/lalem` with a fun isolated skin, toilet-museum home, 热榜, 有用, and no officer/landing entrance.
- `lalem-loo-feed`: Server-side world-toilet catalog (shape/size/class/history + images) plus a cached entertainment/fashion digest with images and playable hot clips, plus short useful bathroom notes.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs).

## Impact

- Frontend: public route in `App.tsx` beside `/fridge-raid` / `/x-hard-data`; new page + isolated styles + i18n keys; `spa-routes.js` copy for `/lalem`. No Dashboard/Navigation/Login/landing links.
- Backend: `GET /api/v1/lalem/toilets` (filterable catalog) and `GET /api/v1/lalem/digest` (entertainment/fashion + useful + hot vids). Same SiliconFlow live text model as Serpico for the daily digest. No vision, no user photo upload.
- Render: no new service. SPA rewrite plus spa-routes. Same `SILICONFLOW_*` config.
- Abuse surface: public unauthenticated AI digest — in-memory cache + per-IP rate limit.
- Does not revive Chase Game, change officer chat, or add this app to the Serpico product shell.
