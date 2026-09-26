# Proposal

## Why

拉了么、睡了么、and 肾结石快消散 are unlisted side apps for a moment in the day. 小茂密咖啡 is the same kind of visit, for the drink: a single cute page where students and young office workers can browse a China-trending coffee and tea menu, and every cup is a kitten with a cute name. The shop has no public landing yet, and a plain drink list would not match the audience (teenage girls, young women, and the young working class).

## What Changes

- Add a **public single-page** side app at `/xiaomaomi` named **小茂密咖啡**. Same unlisted arrangement as the lounges (CN default, isolated skin, no officer entrance) and a **different shape**: one scrolling page, not docks, not chat, not a knowledge encyclopedia.
- **Kitten menu, not a catalog dump.** Twelve original drinks across coffee, tea, and tea-coffee fusion, each with a cute Chinese name, an English kitten name (the signature example is Siamese Baby Kitten Sugar Coffee), a one-line cup story, and one generated kitten-and-drink picture. Chips on the same page filter 全部 / 咖啡 / 茶 / 茶咖. A card opens a bottom sheet. No prices, no street address, no WeChat, no checkout — those facts were not provided, so the page does not invent them.
- **Trends, original names.** Menu stories follow 2026 China café habits (morning Americano and cold brew for class and commute, afternoon light-milk jasmine and fruit tea, salted milk-fat, fruit latte, jasmine yuanyang, plum Americano for night study, Yunnan pour-over for flavor). Product titles stay original. No Luckin, Heytea, Starbucks, or other chain SKU names.
- **Generated kitten art.** Local AI images of wholesome cute kittens with the drink. Not Wikimedia photos, not hotlinks, not human models. One hero mascot plus one image per drink, unique hashes.
- Isolated **cream-and-rose** skin (`html.xm-world` / `.xm-*`), light and easy to read, aimed at the audience above. Do not reuse `.ll-*`, `.sm-*`, `.kx-*`, luxury gold `#c6a56a`, or hot pink `#ff4d8d`. Do not restyle officer chrome, Fridge Raid, 拉了么, 睡了么, or 肾结石快消散.

## Capabilities

### New Capabilities

- `xiaomaomi-page`: Unlisted Chinese-default single page at `/xiaomaomi` with an isolated cream-rose skin, hero, on-page drink chips, kitten cards, bottom sheets, and no officer entrance, chat, or invented shop facts.
- `xiaomaomi-menu`: The twelve-drink kitten menu (coffee, tea, tea-coffee), cute bilingual names, trend blurbs, and local generated images. No backend, no prices, no chain trademarks.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs).

## Impact

- Frontend only: public route in `App.tsx` beside `/lalem`, `/shuileme`, and `/kuaixiaosan`; `Xiaomaomi.tsx` + isolated CSS + i18n; `spa-routes.js` copy for `xiaomaomi` only (no nested path); generated rasters under `frontend/public/xiaomaomi/`; a typed menu module; `xiaomaomiAbsence` isolation tests; `hardDataUrls.ts` stamp.
- Backend: no new routes, no chat POST, no SQLite.
- Render: no new service. Frontend auto-deploy on `main` is enough. Unknown paths stay 404; `/xiaomaomi` must be a static 200.
- Does not change `/lalem`, `/shuileme`, or `/kuaixiaosan` behavior, Fridge Raid, officer Navigation, or PR #104.
