## 1. Toilet wiki URLs and distinct SVGs

- [x] 1.1 Add `wikiUrlZh` and `wikiUrlEn` on every toilet in `lalem_toilets.json` (https `zh.wikipedia.org` / `en.wikipedia.org`, closest type article per design table) and expose them on `GET /api/v1/lalem/toilets`; verify catalog/handler tests that every item has both hosts and scheme https
- [x] 1.2 Redraw `/lalem/toilets/*.svg` so each `shape` uses a unique geometry template and same-shape cousins differ by more than caption/color; verify a test that after stripping fill/stroke colors and `<text>`, mixed-shape files are not equal and at least one same-shape pair still differs

## 2. Paper and wipe catalog

- [x] 2.1 Embed `lalem_papers.json` (≥8 items covering xylospongium, newspaper/leaves, 厕筹 or equivalent, roll paper, wet wipe, bidet/washlet water, bum-gun) with images, blurbs, and wiki URLs; add `GET /api/v1/lalem/papers`; verify API test: count, every image + both wiki hosts, no live-model call
- [x] 2.2 Add distinct local `/lalem/papers/*.svg` (not the toilet ellipse template); verify the same geometry-normalization test covers paper files

## 3. Medicine encyclopedia catalog

- [x] 3.1 Embed `lalem_medicine.json` with articles `posture-squat-sit`, `footstool-lean`, `straining-valsalva`, `time-on-bowl`, `pelvic-floor`, `hemorrhoids`, `constipation` (CN+EN multi-paragraph bodies, Wikipedia + ≥1 allowlisted org URL each); add `GET /api/v1/lalem/medicine`; verify tests: source hosts allowlisted, bodies are not one-liners, copy does not say “you have” a disease, handler does not call the live model
- [x] 3.2 Confirm officer `BuildChatPrompt` still has no 拉了么 primer and digest increment is not used as 医典 bodies; verify existing prompt isolation tests still pass

## 4. Digest without videos, trends with topicId

- [x] 4.1 Stop attaching curated videos in digest compose; `videos` MUST be `[]`; verify digest handler/catalog tests no longer require a playable `srcUrl` and the payload has empty `videos`
- [x] 4.2 Add `MapLalemTrendTopic` + optional `topicId` on trends (`toilet:id` / `paper:id` / `medicine:id`) from curated keywords (and honor a known id if the model sent one); verify unit tests: 蹲 maps to posture article, unknown joke title maps empty, known id is kept

## 5. Lounge UI

- [x] 5.1 Split toilet cards into wiki `<a>` on the image (`target=_blank` `rel` noopener, locale URL) and a title button that opens the sheet (sheet also shows the wiki link); verify RTL: CN image href is zh.wikipedia.org, EN toggle uses en.wikipedia.org, title click still opens the dialog
- [x] 5.2 Add dock 厕纸 and 医典 (five items total), persist new dock ids, paper gallery + medicine article list using the shared sheet, 医典 shows disclaimer + wiki and org links; verify RTL opens 厕纸 gallery and a 医典 article with both link kinds; `lalemAbsence` still has no officer nav
- [x] 5.3 Remove 热榜 `<video>` UI; make trend cards open the mapped encyclopedia sheet or a lounge-copy sheet; verify RTL: no `video` in the document on 热榜, mapped fixture opens 医典/纸/马桶 detail, unmapped still opens a sheet, sit-alert tests still pass

## 6. Isolation and verify

- [x] 6.1 Confirm no luxury gold from PR #104, no Navigation/`Notification`, no Douyin/YouTube embed, Fridge Raid path unchanged; verify `lalemAbsence` and a grep that `Lalem.tsx` has no `<video>` and no `Notification`
- [x] 6.2 Run 拉了么 frontend tests plus `go test ./internal/ai ./internal/api ./internal/database -count=1` and verify they pass
