## Why

Visitors still see 8-bit line sprites instead of real toilets and 厕纸, call 热榜 pictures huge and unfunny, and find the lounge too dark to feel fun. 拉了么 should look like a playful night stall: real interesting photos, a 拉榜 dock, small funny trend thumbs, and a colorful dark theme.

## What Changes

- **BREAKING:** Rename the fourth dock **热榜 → 拉榜** (English **La bang**, matching “La le me”). i18n, tests, and any visitor-facing copy that said 热榜 for this dock MUST follow.
- **BREAKING:** Replace packaged 8-bit SVG toilet **and** 厕纸 card art with **real photographs** sourced from the open internet (interesting, good-looking fixtures and paper products). Package them **locally** under the existing `imageUrl` paths (jpg/webp). Do **not** keep the NES rect sprites as the card image. Do **not** hotlink live Wikimedia/Unsplash URLs from the browser (same leave-lounge / mixed-CDN problem as wiki links).
- **BREAKING:** 拉榜 rows MUST show a **small** funny/interesting picture (thumbnail, not a 16:10 poster) plus the existing kind tag, title, and hook. The previous “no list `<img>`” rule is superseded for this dock only. Still no `<video>`.
- **BREAKING:** Lift the lounge from near-black calm tokens to a **fun dark mode**: still `color-scheme: dark`, but warmer/brighter surfaces and more saturated accents so it does not feel like a cave. Isolated `.ll-*` / `html.ll-world` only.
- Keep the in-app Wikipedia reader (no `wikipedia.org` `<a>`). Do not merge luxury gold PR #104. Do not restyle officer Navigation, Fridge Raid, or landing.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed` from existing 拉了么 changes (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Dock label 拉榜; real packaged photos for toilets and 厕纸; compact funny 拉榜 thumbs; fun-dark chrome. Sit alerts, Chinese default, five docks, in-app wiki, and no officer entrance stay.
- `lalem-loo-feed`: Catalog `imageUrl` values stay local paths but point at photographic files; trend image pool is small funny local photos, not huge SVGs.

## Impact

- Frontend: `catalog.ts` dock copy; `index.css` `--ll-*` tokens, card/trend image size (`object-fit: cover`, no `pixelated` requirement); `Lalem.tsx` 拉榜 thumb markup; `frontend/public/lalem/toilets|papers|trends` replaced with photos; isolation tests rewrite dark-token and “no trend img” assertions.
- Backend: toilet/paper JSON paths may change extension (`.jpg`/`.webp`) while ids stay. Wiki GET unchanged. Same SiliconFlow text path; no vision; no Douyin.
- Render: frontend auto-deploy on `frontend/**` (photos + CSS). Backend only if catalog JSON under `backend/**` changes.
