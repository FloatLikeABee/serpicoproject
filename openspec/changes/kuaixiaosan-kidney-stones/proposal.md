# Proposal

## Why

People already have 翻冰箱 in the kitchen, 拉了么 on the toilet, and 睡了么 in bed. They also sit with a phone during kidney-stone pain, after a procedure, or while hunting for **how stones form, typical cases, and how people recover** — and they need a **dense, unlisted knowledge lounge** with **real photographs** and a **feeling-and-recovery chat**, not officer Serpico, not a clinic that diagnoses, and not a generated-image slideshow.

## What Changes

- Add a **public one-page side app** at `/kuaixiaosan` named **肾结石快消散**. Same arrangement as 睡了么 / 拉了么 (unlisted URL, CN default, isolated skin, photo cards + bottom sheets, one-thumb dock) but **about kidney stones**: types, typical cases, recovery steps, encyclopedia detail, imaging/anatomy photos, plus a dedicated chat.
- **Knowledge and cases first:** illustrated-with-**real-photos** docks for **stones**, **cases** (de-identified encyclopedia vignettes, not identifiable patient faces), **recovery**, **lore**, and **imaging/anatomy**. Copy is sourced encyclopedia — never diagnose, never “you have / 你患有”, never prescribe doses.
- **Chat from day one:** dock **聊** plus nested public route `/kuaixiaosan/chat` (same SPA copy trick as `/shuileme/chat`) so the path is HTTP 200 inside the lounge. The bot **asks what the visitor feels** (pain place, fever, urine, after-procedure) and answers with **recovery steps** plus red-flag “seek emergency care” encyclopedia lines. Dedicated `POST /api/v1/kuaixiaosan/chat`. Canned fallback. Thinking indicator.
- **As many real images as possible:** locally packaged Wikimedia Commons / public-domain JPEGs (unique hashes, no AI-generated stills, no hotlinks). Sequential gallery reveal like 睡了么 beds.
- Isolated **stone/water** skin (`html.kx-world` / `.kx-*`). Do not reuse `.ll-*` pops, `.sm-*` night tokens, sit-alerts, companion, or luxury gold `#c6a56a`. Do not restyle officer chrome, Fridge Raid, 拉了么, or 睡了么.

## Capabilities

### New Capabilities

- `kuaixiaosan-page`: Unlisted Chinese-default 肾结石快消散 lounge at `/kuaixiaosan` (and `/kuaixiaosan/chat`) with an isolated skin, stone/case/recovery/lore/imaging museums, feeling-and-recovery chat, and no officer/landing entrance.
- `kuaixiaosan-stone-feed`: Server-side catalogs (stones, cases, recover, lore, imaging with sourced encyclopedia copy + local real photographs) plus in-lounge wiki summary and public chat POST. No SQLite archive.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs).

## Impact

- Frontend: public routes in `App.tsx` beside `/lalem` and `/shuileme`; `Kuaixiaosan.tsx` + isolated CSS + i18n; `spa-routes.js` copies for `kuaixiaosan` and `kuaixiaosan/chat`; packaged JPEGs under `frontend/public/kuaixiaosan/`; `kuaixiaosanAbsence` isolation tests; `hardDataUrls.ts` stamp.
- Backend: `GET /api/v1/kuaixiaosan/stones|cases|recover|lore|imaging|wiki`; `POST /api/v1/kuaixiaosan/chat`. Static JSON catalogs (no SQLite increment). Wiki allowlist mirrors 拉了么/睡了么 (zh/en Wikipedia REST only). SiliconFlow `CompleteFn` for chat, canned when down.
- Render: no new service. Same SPA + API deploys. Nested chat path must be a static 200 (spa-routes), not officer 404.
- Does not change `/lalem` or `/shuileme` behavior, Fridge Raid, officer Navigation, or PR #104.
