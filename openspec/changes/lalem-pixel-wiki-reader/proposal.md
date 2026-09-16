## Why

Toilet cards still use vector cartoons, 热榜 still leads with a huge picture, and Wikipedia `<a target="_blank">` links hand the visitor to the Wikipedia **app** on phones. Visitors want pictures that feel like a game cartridge, trends that are tags not posters, and encyclopedia reading **inside** 拉了么.

## What Changes

- **BREAKING:** Do **not** hotlink real internet / Wikimedia photos as card bitmaps (copyright, mixed quality, and the same “leave the lounge” problem as the wiki app). Redraw toilet **and** 厕纸 card images as **8-bit pixel sprites** (NES-like), one shared sprite palette that is colorful on the existing calm-dark `--ll-*` chrome.
- **BREAKING:** Wikipedia in 拉了么 MUST open an **in-app wiki reader modal** fed by the official Wikipedia REST summary API through our backend. MUST NOT use `href` to `*.wikipedia.org` (that is what launches the wiki app). MUST NOT iframe Wikipedia. MUST NOT scrape full article HTML.
- 热榜 cards MUST drop the large hero picture. Kind is a **small tag**; title and hook stay. No `<video>`.
- 医典 Wikipedia sources use the same in-app reader. Allowlisted clinic URLs (NHS, Mayo, etc.) MAY still leave the lounge (they are not the Wikipedia app).
- Isolated `.ll-*` / `html.ll-world` only. Do not merge luxury gold PR #104. Do not restyle officer Navigation, Fridge Raid, or landing.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed` from existing 拉了么 changes (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Pixel-sprite galleries; 热榜 as tagged compact cards; Wikipedia opens in an in-app reader, not a new tab / wiki app. Sit alerts, Chinese default, five docks, and no officer entrance stay.
- `lalem-loo-feed`: Public GET that returns a Wikipedia REST summary for an allowlisted wiki URL so the lounge can render it without navigating to wikipedia.org.

## Impact

- Frontend: `Lalem.tsx` (wiki buttons, trend tags, wiki modal); `index.css` (`image-rendering: pixelated`, `.ll-trend-tag`); packaged sprites under `frontend/public/lalem/toilets|papers`. Tests rewrite the current `target=_blank` Wikipedia assertions.
- Backend: `GET /api/v1/lalem/wiki?url=` (host allowlist `zh.wikipedia.org` / `en.wikipedia.org` only). Catalog JSON image paths stay local. Same SiliconFlow text path; no vision; no Douyin.
- Render: frontend + backend auto-deploy on `main` (`frontend/**` and `backend/**`).
