# Tasks

## 1. Failing contracts (TDD — no production code yet)

- [ ] 1.1 Flip frontend contracts: 医典 RTL shows at least 50 `.ll-card img` (or `.ll-card-wiki img`) with `src` under `/lalem/medicine/` ending in `.jpg`; image is not inside `.ll-card-open`; tapping the first card image opens the wiki dialog via `/lalem/wiki?url=`; tapping the title still opens the article sheet with a photo, disclaimer, and NHS (or other clinic) `<a>`; `querySelector('video')` is null; no `wikipedia.org` `<a>`. Use `Array.from` (not iterator spreads). Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalemAbsence|Lalem.test'` **fails** while 医典 is still a `.ll-lore-list` of text buttons
- [ ] 1.2 Flip Go contracts: every `LalemMedicineArticles()` item has `imageUrl` `/lalem/medicine/<id>.jpg` (no `://`); file exists under `LalemPublicRoot()`, JPEG SOI, no `<svg>` bytes; SHA-256 unique within medicine and vs toilets/papers. Verify `cd backend && go test ./internal/ai ./internal/api -count=1` **fails** while medicine JSON has no `imageUrl` and `frontend/public/lalem/medicine/` is missing

## 2. Catalog schema

- [ ] 2.1 Add `imageUrl` and `credit` to `LalemMedicine`; set each of the ≥50 articles to `/lalem/medicine/<id>.jpg` plus a short credit string. Do not drop existing ids or sources. Verify medicine JSON unmarshals and the path assertions from 1.2 fail only on missing files (not missing fields)

## 3. Photo pack

- [ ] 3.1 Package one encyclopedia-safe JPEG per article under `frontend/public/lalem/medicine/` (Commons or other open license; closest-analog OK; no lesions/gore/exam shots). Resize long edge ~960px, JPEG, target ≤200KB. Append `ATTRIBUTION.md` rows. Do not copy toilet/paper/trend file bytes and do not cycle the six 拉榜 thumbs. Verify 1.2 uniqueness + JPEG tests pass and `GET /api/v1/lalem/medicine` returns `imageUrl` for every article

## 4. 医典 gallery UI

- [ ] 4.1 Render 医典 with the same `.ll-card` gallery as 厕纸 (map every article). Image control opens in-app wiki using the locale-matched Wikipedia source (fallback: any Wikipedia source on the article). Title opens the sheet; sheet shows the photo above disclaimer/body; clinic links stay outbound. Verify 1.1 RTL passes; 拉榜/马桶/厕纸 tests still pass

## 5. Isolation

- [ ] 5.1 Isolation: no `wikipedia.org` `<a>`, no `<video>`, no `#c6a56a` / `ll-chip-track`, Fridge Raid and officer pages untouched, 拉榜 increment unchanged. Bump `hardDataUrls.ts` stamp. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem|catalog.test'` and `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` pass. Confirm `unset CI && cd frontend && npm run build` succeeds (no new iterator-spread TS2802)
