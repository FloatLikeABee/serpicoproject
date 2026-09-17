# Tasks

## 1. Failing contracts (TDD — no production code yet)

- [x] 1.1 Flip frontend contracts: 医典 catalog/list tests require `articles.length >= 50` unique ids; RTL 医典 dock shows at least 50 lore buttons; 拉榜 RTL with a 50-item digest fixture shows at least 50 `.ll-trend img` and `querySelector('video')` is null; still no `wikipedia.org` `<a>`. Use `Array.from` (not iterator spreads) so CRA `es5` typecheck stays green. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalemAbsence|Lalem.test|catalog.test'` **fails** while 医典 still has 7 articles and digest fixtures still have ≪50 trends
- [x] 1.2 Flip Go contracts: medicine catalog test `len(articles) >= 50`, unique ids, each has CN/EN body plus a Wikipedia https source and one allowlisted NHS/Mayo/MedlinePlus/Cleveland/WHO host; canned CN and EN trend packs each have ≥50 unique titles; pad-to-50 helper turns a 4-title live batch into 50 unique local `.jpg` cards; digest handler empty-store GET returns ≥50 persisted unique titles; handler with 8 stored titles returns ≥50 **including those 8**; next Shanghai day still appends ~2 unique titles + 1 useful without dropping below 50. Verify `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` **fails** on the current 7-article catalog and 4-title canned pack

## 2. 医典 catalog

- [x] 2.1 Expand `lalem_medicine.json` to ≥50 articles; keep the existing seven ids; new kebab-case ids; encyclopedia tone, no diagnosis/prescription/clinic claims; each article has Wikipedia + allowlisted medical URL. Verify 1.2 medicine assertions pass and `GET /api/v1/lalem/medicine` returns `len(articles) >= 50`

## 3. Canned 拉榜 pack and pad

- [x] 3.1 Grow `cannedLalemTrends` to ≥50 unique titles per locale (entertainment-first, then fashion); add a pad helper that appends unused canned titles (cycling `LalemTrendImagePool` `.jpg`) until 50 unique; do **not** change `capLalemIncrementDigest` (still 2 trends / 1 useful). Verify canned uniqueness tests and the 4-to-50 pad test from 1.2 pass

## 4. Seed and top-up on digest GET

- [x] 4.1 On digest GET, after prune: empty store seeds ≥50 unique (live + pad) and persists them; warm store with <50 unique titles appends until 50 without delete; top-up MUST NOT bump `last_increment_date` by itself; if a Shanghai increment is also due, still append ~2 unique trends + 1 useful after the floor. Verify empty-seed, 8-row top-up, and next-day increment tests from 1.2 pass; `videos` stays `[]`

## 5. Lounge list + isolation

- [x] 5.1 Keep mapping every `articles` / `digest.trends` row (no client-side cap). Verify 1.1 RTL 医典 ≥50 buttons and 拉榜 ≥50 thumbs; mapped/unmapped sheets unchanged; wiki GET path unchanged
- [x] 5.2 Isolation: no `wikipedia.org` `<a>`, no `<video>`, no `#c6a56a` / `ll-chip-track`, Fridge Raid and officer pages untouched. Bump `hardDataUrls.ts` stamp. Verify `cd frontend && CI=true npx react-scripts test --watchAll=false --testPathPattern='lalem|Lalem|catalog.test'` and `cd backend && go test ./internal/ai ./internal/api ./internal/database -count=1` pass. Confirm `unset CI && cd frontend && npm run build` succeeds (no new iterator-spread TS2802)
