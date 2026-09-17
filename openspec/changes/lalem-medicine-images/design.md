# Design

## Context

See proposal.md — Why. 医典 is a static JSON catalog of ≥50 sourced articles (`backend/internal/ai/lalem_medicine.json`) with no `imageUrl`. The 医典 dock is `.ll-lore-list` text buttons. 马桶 and 厕纸 already use `.ll-card` photo galleries: local `/lalem/{toilets,papers}/*.jpg`, image tap → in-app wiki GET, title tap → sheet. 拉榜 cycles six trend JPEGs; that pool is the wrong analog for an encyclopedia. `frontend/public/lalem/ATTRIBUTION.md` already lists Commons/NASA packs. Isolation `.ll-*` / `html.ll-world`. Unmerged luxury gold PR #104 stays out.

## Goals / Non-Goals

**Goals:**

- One local JPEG per 医典 article, listed as photo cards like 厕纸.
- Image → wiki GET; title → sheet with photo + existing encyclopedia copy.
- Raster uniqueness vs toilets/papers; no hotlinks.

**Non-Goals:**

- New 医典 articles, daily 医典 generator, or SQLite lore store.
- Changing 拉榜 increment, trend pool, or 有用.
- Clinical illustration sets, AI image generation at request time, or live Commons URLs in the browser.
- Officer, Fridge Raid, or landing restyle.

## Decisions

### 1. Same card chrome as 厕纸, not 拉榜 thumbs

Replace `.ll-lore-list` with the existing `.ll-card` gallery used by 厕纸. Image is `.ll-card-wiki` (in-app wiki). Title is `.ll-card-open` (sheet). Sheet adds `<img src={item.imageUrl}>` above the disclaimer/body. Keep listing every article (no client cap). Compact 拉榜 rows stay on 拉榜 only.

**Alternative:** Keep text rows and add a tiny thumb. Rejected: visitors asked for images “as well” as 马桶/厕纸, which are square photo cards.

### 2. One packaged JPEG per article id

Add `imageUrl` (required) and `credit` (pack attribution, same idea as toilets) to `LalemMedicine`. Path stem `/lalem/medicine/{id}.jpg`. Download Commons (or other open-license) photos at apply time, long edge ~960px, JPEG quality ~78, target ≤200KB, JPEG SOI, no `<svg>` in file. Append rows to `ATTRIBUTION.md`. Runtime `imageUrl` never contains `://`.

Closest-analog photos are allowed when a topic has no safe literal photo (e.g. dietary fiber → grain/produce; hemorrhoids encyclopedia → washbasin or anatomical diagram, never a lesion). Do **not** cycle the six 拉榜 files and do **not** copy toilet/paper bytes.

**Alternative:** Cycle a small medicine pool. Rejected: 50 cards would look cloned; toilets/papers already require distinct files.

### 3. Wiki URL for the image button

Medicine items have `sources[]`, not `wikiUrlZh`/`wikiUrlEn`. The card image uses the first Wikipedia https URL whose host matches the lounge locale (`zh.wikipedia.org` vs `en.wikipedia.org`), falling back to any Wikipedia source on the article. Sheet Wikipedia buttons stay as they are. Clinic/WHO links stay outbound `<a>`.

### 4. Tests (TDD)

- Frontend: 医典 dock has ≥50 `.ll-card img` (or `.ll-card-wiki img`) with local `/lalem/medicine/*.jpg`; image is not nested in the title control; `querySelector('video')` is null; no `wikipedia.org` `<a>`. Fixtures include `imageUrl`. Use `Array.from`, not iterator spreads.
- Go: every article `imageUrl` local jpg, file exists, JPEG SOI, unique SHA-256 within medicine and vs toilets/papers; existing ≥50 sourced-copy assertions stay.
- Isolation + `hardDataUrls.ts` stamp.

## Risks / Trade-offs

- **[50 unique Commons photos are tedious / some topics are graphic]** → Prefer fixtures, hygiene, food, sanitation, calm diagrams; closest-analog + ATTRIBUTION note; never lesions.
- **[SHA-256 collides with an existing toilet/paper file]** → Pick a different Commons file; tests fail the clone.
- **[Render frontend size]** → Keep each JPEG ≤200KB; 50 × 200KB is acceptable for this static pack.
- **[Wiki source missing for locale]** → Fall back to the other Wikipedia source already required on every article.

## Migration Plan

Ship frontend photos + JSON `imageUrl` together. Rollback: revert JSON field and `public/lalem/medicine/`; dock returns to text if imageUrl empty — prefer not to support mixed empty images; all-or-nothing in this change. No SQLite migration.

## Open Questions

None that block apply. 医典 still does not grow daily.
