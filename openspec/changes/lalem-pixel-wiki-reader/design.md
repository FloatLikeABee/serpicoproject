## Context

See `proposal.md` for motivation and `specs/lalem-page/spec.md` plus `specs/lalem-loo-feed/spec.md` for behavior.

Today toilet/paper images are smooth SVGs wrapped in `<a href="https://zh.wikipedia.org/..." target="_blank">`. On iOS that Universal Link opens the Wikipedia app. 热榜 cards use the same 16:10 hero as toilets. Chrome is already calm dark (`--ll-*`); do not throw that away.

Self-grill (locked, not open questions):

- **Hotlink real photos / Wikimedia files?** No. Copyright, mixed quality, and outbound URLs leave the lounge the same way wiki links do. The user offered 8-bit as the fallback; that is the product.
- **Pixel toilets only, leave 厕纸 as vectors?** No. Same gallery pattern; mixed media looks unfinished.
- **Iframe wikipedia.org in the modal?** No. `X-Frame-Options` blocks it; a navigable wiki URL still launches the wiki app.
- **Full article HTML scrape?** No. Official REST **summary** extract only.
- **NHS / Mayo in the wiki modal too?** No. Those are not the Wikipedia app. Keep ordinary https links.
- **Pitch-black OLED + neon sprites? Luxury gold #104?** No. Colorful NES palette on existing `--ll-*` surfaces. Keep `#c6a56a` / `ll-chip-track` banned.
- **Officer / Fridge Raid restyle?** No.

## Goals / Non-Goals

**Goals:**

- Local 8-bit sprites for toilet and paper cards; CSS `image-rendering: pixelated`.
- Compact 热榜 rows with `.ll-trend-tag`, no hero `<img>`.
- `GET /api/v1/lalem/wiki?url=` + in-app dialog; `Lalem.tsx` has no Wikipedia `<a href>`.

**Non-Goals:**

- Live image models, Douyin, videos, Traditional Chinese, merging #104, changing sit-alert behavior, clinic-page in-app readers.

## Decisions

### 1. Pixel SVG sprites, not PNG photos

Keep paths like `/lalem/toilets/roman-forica.svg`. Redraw each file as a small integer grid (`viewBox="0 0 32 32"` or `48 32`) of `<rect>` pixels. Shared fills only from a sprite sheet: `--ll-px-ink` `#12161c`, `--ll-px-teal` `#8ec5c0`, `--ll-px-clay` `#d47b6a`, `--ll-px-leaf` `#7a9e6e`, `--ll-px-sand` `#e8d5a3`, `--ll-px-steel` `#6b8cae` (none of `#c6a56a` / `#ff4d8d`). CSS: `.ll-card img { image-rendering: pixelated; aspect-ratio: 1 / 1; }`.

- **Why:** Existing uniqueness tests can still strip fill/text; no hotlink; NES look.
- **Alternative considered:** Real Wikimedia JPEGs. Rejected — spec forbids photos.
- **Alternative considered:** PNG 32×32. Workable, but SVG keeps the current catalog test pipeline.

### 2. Wikipedia REST summary via our GET

`GET /api/v1/lalem/wiki?url=` (public, same CORS pattern as other 拉了么 GETs). Parse `url`; allow only `https` + host `zh.wikipedia.org` or `en.wikipedia.org` + non-empty `/wiki/...` path. Fetch `https://{host}/api/rest_v1/page/summary/{title}` with a descriptive User-Agent. Return `{ title, extract, lang, sourceUrl }`. 404/upstream failure → 502 JSON the modal can show as lounge copy. Never call SiliconFlow. Unit tests mock HTTP; reject `example.com`.

Frontend: card image is `<button type="button" class="ll-card-wiki">`, sheet 维基 is `<button>`. Both set wiki-reader dialog state. `document.querySelectorAll('a[href*="wikipedia.org"]')` in `Lalem.tsx` MUST be empty. Source URL may be shown as **text**, not a link.

- **Why:** Staying on `serpico.onrender.com` is the only way the Wikipedia app cannot intercept.
- **Alternative considered:** `target=_blank` + `rel=noopener`. That is the current bug.
- **Alternative considered:** iframe. Wikipedia refuses framing.

### 3. Trend tag, not poster

`.ll-trend` becomes a compact row: `<span class="ll-trend-tag">` from `kind` (i18n `lalem.kind.fashion` / entertainment), then title + hook. No `<img>` on the 热榜 list. Detail sheet for unmapped trends also MUST NOT use a 16:10 hero; mapped encyclopedia sheets keep their own pixel/sheet chrome.

- **Why:** Visitors called the picture a huge label.
- **Alternative considered:** Tiny 24px icon. A text tag is clearer in CN/EN.

## Risks / Trade-offs

- **[Summary is shorter than the full wiki page]** → Mitigation: extract is the in-app read; we do not pretend it is the whole encyclopedia.
- **[Wikipedia REST 429 / 404]** → Mitigation: modal error copy; no outbound fallback link (that would re-open the wiki app).
- **[Pixel SVGs still look smooth if scaled with bilinear]** → Mitigation: `image-rendering: pixelated` plus integer viewBox.
- **[Five dock labels + wiki dialog stacking]** → Mitigation: wiki dialog `z-index` above sheet (sheet is 20; sit-alert is 40; wiki reader 30).

## Migration Plan

1. One PR to `main`: backend wiki GET + sprites + Lalem markup. Render auto-deploys frontend and backend (`frontend/**` and `backend/**`).
2. Rollback: revert the PR.

## Open Questions

None. Self-grill above is the decision list.
