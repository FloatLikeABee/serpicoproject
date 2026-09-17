# Design

## Context

See `proposal.md` for motivation and `specs/lalem-page/spec.md` plus `specs/lalem-loo-feed/spec.md` for behavior.

Current lounge (post pixel-wiki): dock `lalem.dock.hot` is 热榜 / Hot; toilet and paper cards are 32×32 `<rect>` SVG sprites with `image-rendering: pixelated`; 拉榜/热榜 list has a kind tag and **no** `<img>`; `--ll-bg` is near-black `#12161c`. Wiki GET and in-app reader stay. Unmerged luxury gold PR #104 stays out.

Self-grill (locked, not open questions):

- **Hotlink Wikimedia/Unsplash at runtime?** No. Same leave-lounge / mixed-CDN problem as wiki `<a>`. Download once during apply, commit rasters under `frontend/public/lalem/`, catalog paths stay local.
- **Keep NES sprites as fallback?** No. Visitors rejected them. Delete the SVG card files after the JPEG pack is in.
- **AI-generated “photos”?** No. User asked for interesting internet photographs.
- **Unsplash random CDN?** No. Prefer Wikimedia Commons (CC0 / public domain / CC BY / CC BY-SA). Skip NC and all-rights-reserved.
- **Pixel toilets, photo paper?** No. Both galleries are photos.
- **拉榜 English = Hot Rank / Trends?** No. **La bang**, matching 拉了么 → La le me.
- **Huge funny posters?** No. Small thumbs (~3.5rem square) plus the existing kind tag.
- **No list image (pixel-wiki rule)?** Superseded for this dock only. Still no `<video>`.
- **Pitch-black OLED, or merge #104 gold?** No. Fun dark: lifted indigo night, saturated mint + apricot. Ban `#c6a56a`, `#ff4d8d` as selected, `#12161c` as `--ll-bg`.
- **Light mode?** No. `color-scheme: dark` stays.
- **Officer / Fridge Raid / landing restyle?** No.
- **Change wiki GET or in-app reader?** No.
- **Faces of people on the toilet?** No. Fixture / product / architecture shots only.

## Goals / Non-Goals

**Goals:**

- Local JPEG photographs for every toilet and paper `imageUrl`; uniqueness tests move from SVG geometry to raster file identity.
- 拉榜 compact row: thumb + tag + title + hook; CSS caps thumb size.
- Fun-dark `--ll-*` tokens; tests lock the new hex values and still ban gold/hot-pink.
- i18n 拉榜 / La bang (dock, empty copy, sit-alert line that named 热榜).
- Digest compose rewrites legacy stored `.svg` trend URLs so SQLite rows do not 404.

**Non-Goals:**

- Live image models, Douyin, videos, Traditional Chinese, merging #104, changing sit-alert timing or wiki allowlist, clinic-page in-app readers.

## Decisions

### 1. Package Commons photographs as JPEG, keep stems

Keep catalog ids and path stems (`/lalem/toilets/roman-forica`, `/lalem/papers/roll-paper`, `/lalem/trends/fashion-1`). Change extension to `.jpg`. Apply downloads one interesting, good-looking Commons (or NASA public-domain) photo per item, resizes long edge to ~960px (trends ~480px), quality ~78, target ≤200KB. `ATTRIBUTION.md` lists file, Commons title, author, license, source URL. Runtime `imageUrl` never contains `://`.

- **Why:** User asked to get nice internet photos, then use them in the app — that is a pack step, not a hotlink.
- **Alternative considered:** Hotlink `upload.wikimedia.org`. Rejected — spec forbids it.
- **Alternative considered:** WebP-only. JPEG is enough and easier to assert (`FF D8` magic).
- **Alternative considered:** One photo reused across a shape. Rejected — uniqueness spec.

Hard-to-photograph historical tools (xylospongium, 厕筹, ISS): use the closest museum reconstruction or NASA public-domain photo and note the analog in `ATTRIBUTION.md`. Do not substitute a sprite.

Trend pool photos MUST be different files from museum cards (neon loo, stacked rolls, gold pan, duck-shaped paper, disco stall — funny at thumbnail size).

### 2. Uniqueness tests become raster contracts

Replace `normalizeLalemSVG` geometry checks with: file exists under `LalemPublicRoot()`; bytes start with JPEG SOI; SHA-256 unique across toilets, across papers, and papers vs toilets; no file contains `<svg`; path suffix `.jpg`; `http` / `://` still forbidden. Frontend fixtures and Go digest tests that hardcode `.svg` switch to `.jpg`.

- **Why:** Photos have no path geometry to strip.
- **Alternative considered:** Perceptual hash. Overkill; distinct files plus shape coverage is the spec.

### 3. 拉榜 thumb layout

`.ll-card.ll-trend` is a three-area row: `grid-template-columns: 3.5rem 1fr` (thumb | text). Thumb `width/height: 3.5rem`, `aspect-ratio: 1 / 1`, `object-fit: cover`, `border-radius: 0.55rem`, `grid-row: 1 / 3`. Text column keeps `.ll-trend-tag` then title then hook. Gallery `.ll-card img` stays ~1:1 `object-fit: cover` and **drops** `image-rendering: pixelated`. Unmapped trend sheet may show the same small thumb, not a 16:10 hero.

- **Why:** Visitors called the picture huge and unfunny; they still want a picture.
- **Alternative considered:** Tag-only (current). Rejected — this change supersedes it.
- **Alternative considered:** 16:10 poster with a joke caption. Rejected — size is the bug.

### 4. Fun-dark tokens (locked hex)

On `html.ll-world` only:

| token | value | role |
| --- | --- | --- |
| `--ll-bg` | `#22183a` | indigo night (not `#12161c`) |
| `--ll-surface` | `#33285a` | lifted stall wall |
| `--ll-text` | `#fff4e8` | warm paper |
| `--ll-muted` | `#c9b8e0` | lilac mute |
| `--ll-accent` | `#3ee0c4` | candy mint selected |
| `--ll-pop` | `#ff9a62` | apricot tag/chip pop |
| `--ll-line` | `rgba(255, 244, 232, 0.16)` | hairline |
| `--ll-gutter` | `1rem` | unchanged |

`color-scheme: dark`. Remove unused `--ll-px-*` sprite tokens. `.is-on` uses accent border + mint tint. `.ll-trend-tag` uses `--ll-pop` fill. No radial wallpaper, no `#c6a56a`, no `#ff4d8d` selected. Alignment rules from the dark-align change stay (gutter, `display: contents` filter rows, two-column gallery, five-column dock).

- **Why:** Fun but still dark; tests can lock exact hex.
- **Alternative considered:** Recolor only the accent on `#12161c`. Rejected — the cave background is what they regret.
- **Alternative considered:** Cherry-pick #104 gold. Rejected.

### 5. i18n and stored digest URLs

`lalem.dock.hot`: 拉榜 / La bang. `lalem.hotEmpty`: 拉榜加热中… / La bang is warming up…. `lalem.sitAlert.t4`: swap 热榜 → 拉榜 (EN equivalent names La bang). Tests that `getByRole(..., '热榜')` or expect `Hot` / `#12161c` / `pixelated` / `.ll-trend img` null MUST flip.

Digest rows in SQLite still store old `/lalem/trends/*.svg`. Compose MUST rewrite a known stem `*.svg` → `*.jpg` (and map unknown legacy URLs onto the pool) so yesterday’s 拉榜 still paints. Toilet/paper catalogs are embed JSON — just change `imageUrl` there.

- **Why:** Deleting SVGs without a rewrite 404s the archive.
- **Alternative considered:** Prune the feed store. Rejected — keep-and-append is the sit-alerts contract.

## Risks / Trade-offs

- **[Commons has no photogenic match for an id]** → Mitigation: closest licensed analog + ATTRIBUTION note; never a sprite and never a hotlink.
- **[Binary size on Render static]** → Mitigation: resize/compress JPEGs; one photo per catalog id, not galleries of extras.
- **[Legacy SQLite `.svg` imageUrl]** → Mitigation: Decision 5 rewrite at compose.
- **[Photo crop looks wrong at 1:1]** → Mitigation: `object-fit: cover`; prefer sources already centered on the fixture.
- **[Fun tokens clash with sit-alert]** → Mitigation: sit-alert keeps its own surface; still no gold border; type scale unchanged.

## Migration Plan

1. One PR to `main`: i18n + CSS tokens + JPEG pack + catalog JSON + digest SVG→JPEG rewrite + tests. Render auto-deploys `frontend/**` (photos + CSS) and `backend/**` (JSON + rewrite).
2. If the static site misses a path-filtered frontend deploy, bump the existing `hardDataUrls.ts` rebuild stamp (same trick as prior lounge ships).
3. Rollback: revert the PR (sprites and 热榜 return).

## Open Questions

None. Self-grill above is the decision list.
