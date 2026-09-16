## Why

拉了么’s toilet cards all share one cartoon bowl, so the museum does not look like the real fixtures, and tapping an image goes nowhere. Visitors asked for Wikipedia on the real thing, a paper-and-wipe history they can actually browse, a detailed posture/force encyclopedia with wiki and clinic links, 热榜 without the clip players, and trends that open that detailed stuff instead of sitting as dead cards.

## What Changes

- Every toilet **image is a link** to a curated **Wikipedia article** about that real fixture or its closest historical type (Simplified Chinese wiki when the lounge is 中文, English wiki when it is English). The in-page sheet stays on `/lalem`; the wiki opens in a new tab. Not a wiki scrape, not an iframe.
- **Redraw** the local toilet illustrations so shapes are visually distinct (sit, squat, trough, vacuum, portable, space, palace chair, child, accessible — not 28 recolors of the same ellipse). No live image-generation model.
- Add a first-class **厕纸** gallery: types of paper and wipes plus **how people used to wipe** (sponge-stick, newspaper, leaves, bidet, bum-gun, and so on), each with an image and wiki (or wiki-equivalent encyclopedia) link.
- Add a first-class **医典** surface: detailed, sourced notes on **defecation position and force** (squat vs sit, footstool, straining/Valsalva, time on the bowl, pelvic floor, hemorrhoids/constipation as encyclopedia — not a clinic). Each article MUST cite Wikipedia **and** at least one allowlisted medical-org page (NHS, Mayo Clinic, MedlinePlus, Cleveland Clinic, WHO, or similar). Keep the existing not-medical-advice line. Do not diagnose the visitor.
- **BREAKING:** Remove 热榜 **video display**. Do not attach curated mp4s to the digest the lounge paints. Do not replace them with Douyin/YouTube embeds.
- **BREAKING:** 热榜 trend cards become **clickable** and open an in-page detail sheet of the related 器具 / 厕纸 / 医典 article (or a lounge-only detail when nothing maps). They are not a video row.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed` from `lalem-toilet-lounge` / `lalem-sit-alerts-feed-store` (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Wiki-linked, visually distinct toilet museum; 厕纸 and 医典 docks; 热榜 without videos; clickable trends into encyclopedia detail. Sit alerts, Chinese default, and no officer entrance stay as they are.
- `lalem-loo-feed`: Catalog items gain Wikipedia URLs; new paper and medicine catalogs; digest drops playable videos and carries a topic id (or equivalent) so a trend can open a curated article.

## Impact

- Frontend: `Lalem.tsx` card markup (image is `<a>` to wiki, not nested inside the sheet button), new dock tabs, encyclopedia sheets, delete `.ll-video` players from 热榜. Isolated `.ll-*` skin only. Do not mix unmerged luxury gold from PR #104. No Navigation / Login / landing links.
- Backend: toilet JSON `wikiUrlZh` / `wikiUrlEn`; new embed JSON (+ public GET) for paper and medicine; digest compose omits videos; trends MAY include `topicId`. Same `SILICONFLOW_*` text path; no vision; no wiki scrape; no new Render service.
- Isolation: officer `/chat`, Fridge Raid name/path, sit-alert overlay, SQLite keep-and-append, and 3-month prune stay. 有用 remains short notes plus disclaimer, not the long 医典.
