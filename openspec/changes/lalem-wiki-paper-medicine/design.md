## Context

See `proposal.md` for motivation and `specs/lalem-page/spec.md` plus `specs/lalem-loo-feed/spec.md` for behavior.

`/lalem` already has a toilet gallery (`GET /api/v1/lalem/toilets` from embed `lalem_toilets.json`), in-page sheets, 热榜/有用 from SQLite digest, sit alerts, and curated mp4s composed onto digest. Every toilet SVG is the same ellipse-and-tank drawing with a different fill and caption. Cards are a single `<button>` wrapping the image, so the image cannot be a wiki `<a>`. 热榜 trends are dead `<article>`s plus a `<video>` row.

Self-grill (locked, not open questions):

- **Wikimedia Commons / Wikipedia file hotlink as the card image?** No. Card bitmaps stay on the local pack. Wiki is the **destination** of the image link. Hotlinking Commons is fragile, mixed-content / referrer messy, and fights the “various generated drawings” request.
- **SiliconFlow (or any) live image model to redraw 28 toilets?** No. Fridge Raid’s key is text (+ vision on raid photos), not a 28-image art pipeline. Cost and rate-limit would hitch the lounge. Hand-authored distinct SVGs.
- **Iframe Wikipedia in the sheet?** No. Wikipedia sends `X-Frame-Options`. New tab only.
- **Scrape wiki HTML into the sheet?** No. User asked for wiki **pages**. Curated URLs, not a proxy.
- **zh wiki for CN, en wiki for EN — fallback to en when zh is missing?** No for the href host. Every row has both URLs. If a fixture has no dedicated zh page, pick the closest zh article (`蹲便器`, `马桶`, `真空厕所`, `航天器马桶`, `移动厕所`, `小便斗`, …), not `en.wikipedia.org` while the lounge is 中文.
- **YouTube / Douyin instead of local mp4s?** No. User said take the trend vids **off**, not swap hosts. Still no social scrape.
- **Delete `public/lalem/videos/` in this change?** No. Stop composing and rendering them. Unused pack can die in a later cleanup.
- **Fold 厕纸 and 医典 under 马桶 chips to keep three dock buttons?** No. User wants to **look at** paper and medicine as destinations, same class as the toilet museum. Five dock items: 马桶 / 厕纸 / 医典 / 热榜 / 有用. Short Chinese labels. Persist the extra dock ids in the existing lounge session blob.
- **Put the long medical text in 有用?** No. 有用 stays short keep-and-append notes plus disclaimer. 医典 is curated long-form.
- **Generate 医典 bodies with DeepSeek on digest GET?** No. Medical encyclopedia is static embed JSON. Daily increment must not invent clinical claims.
- **SQLite column for `topic_id`?** Not required. Compose maps trend title/hook through a curated keyword table onto `topicId` (`toilet:<id>` / `paper:<id>` / `medicine:<id>`). Old archive rows still click. If the model later sends `topicId`, honor it when it matches a known id.
- **Officer nav, Fridge Raid rename, luxury gold PR #104, OS notifications, sit-duration DB?** No. Same locks as `lalem-sit-alerts-feed-store`.
- **Diagnose the visitor / “you have hemorrhoids”?** No. Encyclopedia + links. Disclaimer stays.

## Goals / Non-Goals

**Goals:**

- Wiki outbound links on toilet and paper images; distinct local silhouettes.
- First-class 厕纸 and 医典 surfaces with curated catalogs.
- 热榜 without players; trends open encyclopedia (or lounge-copy) sheets.
- Tests that lock wiki hosts, silhouette distinctness, allowlisted medical hosts, and zero `<video>` on 热榜.

**Non-Goals:**

- Live image generation, wiki scrape/iframe, Douyin/YouTube, mixing PR #104, officer entrance, medical accounts, storing sit time, new Render disk/cron, Traditional Chinese, deleting the unused mp4 pack.

## Decisions

### 1. Card chrome: image is `<a>`, title opens the sheet

Replace the whole-card `<button>` with an `<article class="ll-card">`. The `<img>` sits in `<a href={wiki} target="_blank" rel="noopener noreferrer">`. A separate `<button>` (title + meta) sets the in-page sheet. The sheet repeats the wiki link as text. Same pattern on 厕纸 cards.

- **Why:** Spec forbids nesting the wiki link inside the sheet control. Matches “images … are a link to wiki”.
- **Alternative considered:** Whole card goes to wiki. Rejected — we still need the in-page story sheet.
- **Alternative considered:** Click image → sheet, a “Wiki” chip for Wikipedia. Rejected — user said the **image** is the link.

### 2. Distinct SVG geometry per shape family

Keep `/lalem/toilets/*.svg` on disk. Give each `shape` a unique geometry template (squat pan from above, sit bowl + cistern, wall trough, vacuum cone, portable cabin box, ISS hose+foot restraints, close-stool chair, child reducer, accessible stall with grab bars). Within a shape, vary setting (marble hall vs hutong vs palace wood vs hotel gold vs lab white) so two sits are not clones. Add a unit test that normalizes SVGs (strip `fill`/`stroke` colors, caption `<text>`) and asserts different `shape` files are not equal, and that at least one same-shape pair still differs.

Paper cards get new `/lalem/papers/*.svg` with the same distinctness bar.

- **Why:** Today roman-forica, japan-washlet, and iss-space are color-swaps of one file. That is the bug.
- **Alternative considered:** Photo pack. Rejected — licensing and “generated drawings various”.
- **Alternative considered:** One SVG sprite sheet. Rejected — catalog already uses per-id URLs.

### 3. Embed JSON + public GETs for paper and medicine

Mirror toilets:

- `lalem_papers.json` + `GET /api/v1/lalem/papers`
- `lalem_medicine.json` + `GET /api/v1/lalem/medicine`

Toilet rows gain `wikiUrlZh` and `wikiUrlEn`. Paper rows use the same wiki fields plus shape-like `era` if useful for a single filter row (history vs modern). Medicine rows: `id`, `title`/`titleEn`, `body`/`bodyEn` (several paragraphs), `sources: [{label, url}]`. Server (or test helper) validates every URL: wiki hosts as specified; at least one source host in `{nhs.uk, mayoclinic.org, medlineplus.gov, clevelandclinic.org, who.int}` (allow `www.` / `my.` prefixes). Frontend only paints https allowlisted hrefs.

Paper catalog minimum (ids may match closely): xylospongium, newspaper, leaves, chu-chou (厕筹), corn-cob, roll-paper, wet-wipe, bidet, washlet-water, bum-gun. Spec’s eight are a subset; extras are fine.

Medicine minimum: `posture-squat-sit`, `footstool-lean`, `straining-valsalva`, `time-on-bowl`, `pelvic-floor`, `hemorrhoids`, `constipation`.

- **Why:** Same embed pattern as toilets; no scrape; no live clinical model.
- **Alternative considered:** Markdown files fetched by the SPA. Rejected — backend tests already own catalog JSON; keep one loader.

### 4. Five dock items, one shared sheet

`Dock = 'toilets' | 'paper' | 'medicine' | 'hot' | 'useful'`. i18n: `lalem.dock.paper` = 厕纸 / “Paper”; `lalem.dock.medicine` = 医典 / “Lore”. 医典 list is article titles; open uses the same `.ll-sheet` with body + source links + disclaimer. Session persist accepts the new ids (unknown → toilets).

- **Why:** First-class looking, not buried chips.
- **Alternative considered:** Sub-chips on 马桶. Rejected in self-grill.

### 5. Digest drops videos; trends get `topicId` at compose

`ComposeStoredLalemDigest` MUST NOT attach `LalemCuratedVideos()`. JSON `videos` is `[]`. Frontend deletes the `.ll-videos` block and the test that queries `document.querySelector('video')`.

`LalemTrend` gains optional `topicId`. `MapLalemTrendTopic(title, hook string) string` uses a small keyword table (蹲/squat/坐姿 → `medicine:posture-squat-sit`, 纸/wipe/bidet → a paper id, 痔/hemorrhoid → `medicine:hemorrhoids`, 马桶/washlet → a toilet id, …). Unknown → empty. 热榜 card is a button/article that opens: medicine/paper/toilet sheet when `topicId` parses, else a lounge-copy sheet (`lalem.trend.loungeOnly`).

Do not migrate SQLite. Do not store 医典 in `lalem_useful`.

- **Why:** User asked to take vids off and click into the detailed stuff. Keyword map works for the 3-month archive without a column.
- **Alternative considered:** Keep videos below the cards. Rejected — “take them off”.
- **Alternative considered:** Trend URL to Douyin. Rejected — scrape/embed lock.

### 6. Wiki URL curation (toilets)

Each toilet maps to the **type**, not a tourism page. Examples (apply MUST use real current paths):

| id | zh (closest) | en (closest) |
| --- | --- | --- |
| roman-forica / ostia-latrine | 古罗马公共厕所 or 公共厕所 | Latrine / Communal toilet |
| forbidden-squat / hutong-* / school-squat / onsen-squat | 蹲便器 | Squat toilet |
| japan-washlet / home-long / hotel-gold | 清洗马桶盖 / 抽水马桶 | Toilet / Flush toilet / Washlet |
| pub-trough / osaka-urinal / station-urinal | 小便斗 | Urinal |
| crh-vacuum / airliner-vacuum | 真空厕所 | Vacuum toilet |
| iss-space / capsule-space | 航天器马桶 | Space toilet |
| festival-portable / site-portable | 移动厕所 | Portable toilet |
| versailles-close | 便椅 or 马桶 | Close stool |
| victorian-high | 抽水马桶 | Flush toilet |
| airport-access / museum-access | 无障碍设施 / 抽水马桶 | Accessible toilet |
| indus-drain | 印度河流域文明 / 卫生设施 | Sanitation of the Indus Valley civilisation |

Tests: every `wikiUrlZh` host `zh.wikipedia.org`, every `wikiUrlEn` host `en.wikipedia.org`, path non-empty, scheme https.

## Risks / Trade-offs

- **[Five dock buttons overflow a narrow phone]** → Mitigation: existing `.ll-dock` flex; short two-character Chinese labels; wrap if needed; do not add a sixth.
- **[Wikipedia moves a page]** → Mitigation: curated URLs; tests only lock hosts/path-not-empty. A 404 wiki tab is acceptable vs scrape.
- **[Medical copy is read as advice]** → Mitigation: disclaimer on 医典 and 有用; no “you have X”; allowlisted orgs; no live model bodies.
- **[Keyword map mis-opens 医典 from a joke trend]** → Mitigation: conservative keywords; unmapped trends get the lounge-copy sheet, not a clinic article.
- **[Old frontend still shows videos during a split deploy]** → Mitigation: backend sends `videos: []` so even an old player row is empty; new frontend removes the player. Ship frontend+backend together as usual.

## Migration Plan

1. Ship catalog JSON + new GETs + SVG redraws + lounge UI in one PR to `main` (Render auto-deploy).
2. No SQLite migration. No Blueprint change.
3. Rollback: revert the PR; old SVGs/videos behavior returns.

## Open Questions

None. Self-grill above is the decision list.
