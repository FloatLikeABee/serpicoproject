# Design

## Context

See proposal.md — Why. On `main`, unlisted side apps already exist at `/lalem` (`html.ll-world`), `/shuileme` (`html.sm-world`), and `/kuaixiaosan` (`html.kx-world`): public routes before `ProtectedRoute`, `spa-routes.js` static copies, `enterLoungeWorld` / `leaveLoungeWorld`, CN-default language keys, photo cards, and bottom sheets. Those pages are dark, docked, and (for 睡了么 and 肾结石快消散) chat-backed. 小茂密咖啡 copies the **unlisted public-route arrangement** and changes the **shape** to one light landing page. Specs: `xiaomaomi-page`, `xiaomaomi-menu`. Luxury gold PR #104 stays out.

## Goals / Non-Goals

**Goals:**

- Ship `/xiaomaomi` on the existing frontend Render service only.
- One scrolling page: hero, four chips, twelve kitten cards, one bottom sheet.
- Generated local JPEGs, unique hashes, wholesome kittens.
- Isolation tests so this skin cannot restyle the other lounges.

**Non-Goals:**

- A Go catalog, chat POST, wiki proxy, SQLite, or a new Render service.
- Nested `/xiaomaomi/chat`, a 已看 clock, or a 好了 button.
- Prices, address, hours, phone, WeChat, map, or checkout.
- A shared lounge framework. Copy the route and sheet habits; do not abstract 拉了么.
- Merging PR #104 or archiving existing lounge changes.

## Decisions

### 1. Single page, not a fourth docked lounge

Three shapes were on the table.

**Choice:** One route `/xiaomaomi`, no dock bar, no session clock. Sticky header (title, kicker 茂密, CN/EN). Hero, then chips 全部 / 咖啡 / 茶 / 茶咖, then a card grid. Filter state stays in the component. Path never changes. Sheet is the only overlay.

**Rejected — six docks plus chat, like 睡了么:** The user asked for a single page. Chat needs a backend and a nested SPA copy; 肾结石快消散 just showed that split deploys. A café landing does not need a bot.

**Rejected — real storefront (map, hours, WeChat order):** No address or contact was provided. Inventing one would ship a lie. A later change can add facts when they exist.

### 2. Frontend menu module, not a Go API

**Choice:** `frontend/src/data/xiaomaomiMenu.ts` exports the twelve locked drinks. The page imports it. No `fetch` for the menu, so a slow or old backend cannot blank the grid (the 肾结石快消散 catalog 404). Images stay in `frontend/public/xiaomaomi/`.

**Rejected — `GET /api/v1/xiaomaomi/drinks`:** Same JSON would deploy on a second service for no filter the server must enforce. Chips are client-side.

**Rejected — JSON file fetched from `/xiaomaomi/menu.json`:** An extra request and a flash of empty cards. A typed module is tested by import.

### 3. Twelve cups, trends with original names

The locked table is in `specs/xiaomaomi-menu/spec.md`. Grouping matches how 2026 China drink shops are actually used: morning and night-study coffee (Americano, cold brew, oat latte, pour-over), afternoon cute cups (sugar latte, salted milk coffee, jasmine milk tea, peach and grape fruit tea, salted cheese tea), and tea-coffee fusion (jasmine yuanyang, plum Americano). 茂密 sounds like 猫; the hero line can wink at that. It does not rename the shop.

**Rejected — a 40-item catalog:** A landing gets tiring, and each cup needs its own generated image. Twelve is enough to scroll once.

**Rejected — copying 生椰拿铁 or 轻轻茉莉 as titles:** Those are chain SKUs. The habit can be described; the name stays ours (`茉莉奶绒`, not 轻轻茉莉).

### 4. Generated kitten JPEGs

**Choice:** At apply time, generate thirteen wholesome images (one hero, twelve drinks) of a cute kitten with that cup. No human faces, no real children, no chain logos, no sexualized styling. Write JPEGs:

- `frontend/public/xiaomaomi/hero.jpg`
- `frontend/public/xiaomaomi/drinks/<id>.jpg`

Verify JPEG SOI and twelve-plus-hero unique SHA-256. A short `ATTRIBUTION.md` states they are original generated art for this page, not Commons files. Reuse `queueLoungePhotos` on `.xm-gallery`.

**Rejected — Wikimedia cat photos:** The user asked for generated kittens tied to each drink. Stock cats will not match the cup.

**Rejected — one mascot reused on every card:** The request is a kitten theme per drink, and the unique-hash rule would fail a repeated file.

### 5. Cream-rose tokens, light on purpose

The other lounges are dark. This audience asked for lovely, easy color. Inside `html.xm-world` only:

- `--xm-bg: #fff6f2`
- `--xm-surface: #fffdfb`
- `--xm-text: #4a3040`
- `--xm-muted: #8d6d78`
- `--xm-accent: #a84d6a`
- `--xm-blush: #f3c1d0`
- `--xm-peach: #f3c3a4`

Accent `#a84d6a` is for text and chip borders so rose stays readable on cream. Blush and peach are fills, not the forbidden `#ff4d8d`. Never `#c6a56a`, `#ff4d8d`, `#7ee0ff`, or `#c9f07a`. Extend `LoungeWorld` with `'xm-world'` and add it to the class list `enterLoungeWorld` clears. Do not change `.ll-*`, `.sm-*`, or `.kx-*` rules.

Phone: one column, chips wrap, tap targets at least `2.75rem`. From `720px`, cards in two columns. `Array.from` for NodeLists. Reduced motion: no looping mascot animation.

### 6. Language

`serpico.xiaomaomi.lang`, default `cn`, same `?lang=` / `?nation=` override habit as the other lounges. Do not read or write `serpico.lalem.lang`, `serpico.shuileme.lang`, or `serpico.kuaixiaosan.lang`. CN mode: Chinese title large, English kitten name as the subtitle. EN mode: the reverse. Chrome strings live in the i18n catalog (`xiaomaomi.*`).

### 7. Tests first

Frontend only.

- Menu unit test: exact ids, kind counts, local `.jpg` paths, trademark and price bans, JPEG SOI, unique hashes once files exist.
- Page test: heading, four chips, hero src, 暹罗糖云 sheet, chip filter keeps the path, no textarea, no 已看, no `¥`.
- `App.publicRoutes`: `/xiaomaomi` is the café, not officer login.
- `xiaomaomiAbsence`: this page's source has no officer Navigation import, no `/lalem/` `/shuileme/` `/kuaixiaosan/` fetches, no `#c6a56a` / `#ff4d8d` / `#7ee0ff` / `#c9f07a`, no `video`, no `Notification`. Sibling pages do not import `Xiaomaomi`.

## Risks / Trade-offs

- [Generated kittens look samey or uncanny] → Distinct prompt per id (breed hint, cup color, prop). Fail the unique-hash check rather than duplicate a file.
- [Rose-on-cream contrast fails] → Body text uses `--xm-text`; accent text uses `#a84d6a`, not blush as text.
- [Visitors expect a map and a price] → Copy invites them to browse the kitten menu and does not pretend an address exists. A follow-up change can add real facts.
- [Image generation is slow or blocked] → Do not substitute hotlinked photos or a repeated mascot. Stop and regenerate until thirteen unique JPEGs exist.
- [Frontend-only menu cannot change without a deploy] → Acceptable. Images already require a frontend deploy.

## Migration Plan

1. Land the page on `main`. Frontend `autoDeployTrigger: commit` publishes `/xiaomaomi` via `spa-routes.js`.
2. No backend release is required. Existing `/lalem`, `/shuileme`, and `/kuaixiaosan` APIs stay as they are.
3. Rollback is reverting the commit. The route disappears with the previous static build; no database migration.

## Open Questions

None that change the specs. A real street address, hours, or price list is a later change once those facts exist.
