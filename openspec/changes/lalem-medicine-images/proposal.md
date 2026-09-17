# Proposal

## Why

医典 now has fifty sourced encyclopedia articles, but the dock is still a text list while 马桶 and 厕纸 are photo galleries. Visitors asked for the medical module to have images as well, so the encyclopedia should look like the rest of the lounge.

## What Changes

- Give every 医典 article a **local packaged photograph** (`imageUrl` under `/lalem/medicine/*.jpg`). No CDN hotlinks, no SVG leftovers, no cycling a six-file 拉榜 pool.
- Render 医典 as the same **photo-card gallery** as 厕纸: image tap opens the in-app wiki GET; title tap opens the article sheet, which also shows the photo. Keep the not-medical-advice disclaimer and sourced Wikipedia + allowlisted clinic/WHO links.
- Photos MUST be encyclopedia-safe: fixtures, hygiene, food/fiber, sanitation, calm anatomy diagrams — **not** lesions, gore, exam-table shots, or diagnostic “this is you” imagery.
- Isolation: `/lalem` only. No officer Navigation, Fridge Raid, or landing restyle. Do not merge luxury gold PR #104. Do not change 拉榜 increment, 医典 copy count, or add a daily 医典 generator.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed` from existing 拉了么 changes (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: 医典 dock is a photo gallery of every catalog article; image uses in-app wiki GET (no `wikipedia.org` `<a>`); sheet shows the photo plus existing encyclopedia body.
- `lalem-loo-feed`: Public medicine catalog items each carry a local `/lalem/medicine/*.jpg` `imageUrl` that exists on disk and is not a hotlink.

## Impact

- Frontend: `Lalem.tsx` 医典 dock/sheet markup; `LalemMedicine.imageUrl`; RTL gallery assertions; `frontend/public/lalem/medicine/` pack + `ATTRIBUTION.md`; `hardDataUrls.ts` stamp.
- Backend: `LalemMedicine` JSON schema + `lalem_medicine.json` paths; Go catalog tests for JPEG magic and SHA-256 uniqueness vs toilets/papers.
- Render: frontend path filter on photos/UI; backend on medicine JSON.
