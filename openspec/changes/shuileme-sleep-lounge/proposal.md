# Proposal

## Why

People already have 翻冰箱 in the kitchen and 拉了么 on the toilet. They also lie down with a phone and need a **dim, unlisted bedtime lounge** — sleep knowledge, beds and bedrooms, insomnia encyclopedia, plus sound and visual wind-down — not officer Serpico, not a clinic, and not another stimulating feed that keeps them awake.

## What Changes

- Add a **public one-page side app** at `/shuileme` named **睡了么**. Same arrangement as 拉了么 (unlisted URL, CN default, isolated skin, photo cards + bottom sheets, one-thumb dock) but **inverted for bed**: no sit-alert, no companion nags, no typed chat, no 拉榜-style hot feed.
- **Knowledge first:** illustrated **beds** and **bedrooms** (culture, history, layout, light), plus a **sleep/insomnia lore** dock (circadian, hygiene, stimulus control as encyclopedia — never diagnose, never “you have / 你患有”, never prescribe).
- **Help in the dark:** a **sound** dock (generated bedside noise scenes, tap-to-start) and a **wind-down visual** dock (slow CSS breathe / dim field). No `<video>`, no YouTube/Douyin, no Notification API.
- Isolated **night** skin (`html.sm-world` / `.sm-*`). Do not reuse `.ll-*` pops, sit-alerts, or luxury gold `#c6a56a`. Do not restyle officer chrome, Fridge Raid, or 拉了么.

## Capabilities

### New Capabilities

- `shuileme-page`: Unlisted Chinese-default 睡了么 lounge at `/shuileme` with a dim isolated skin, bed/bedroom museums, sleep lore, tap-to-play soundscapes, wind-down visual, and no officer/landing entrance.
- `shuileme-sleep-feed`: Server-side catalogs (beds, bedrooms, sleep lore with sourced encyclopedia copy + local images) plus an in-lounge wiki summary endpoint. No live digest, no chat POST in this change.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs).

## Impact

- Frontend: public route in `App.tsx` beside `/lalem`; `Shuileme.tsx` + isolated CSS + i18n; `spa-routes.js` copy for `/shuileme`; packaged JPEGs under `frontend/public/shuileme/`; `shuilemeAbsence` isolation tests; `hardDataUrls.ts` stamp.
- Backend: `GET /api/v1/shuileme/beds|bedrooms|lore|wiki`. Static JSON catalogs (no SQLite increment, no SiliconFlow in v1). Wiki allowlist mirrors 拉了么 (zh/en Wikipedia REST only).
- Render: no new service. Same SPA + API deploys.
- Does not change `/lalem` behavior, Fridge Raid, officer Navigation, or PR #104.
