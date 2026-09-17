# Proposal

## Why

医典 currently has **seven** posture/force articles and 拉榜 seeds **four canned / eight live** cards, so both docks feel like a pamphlet. Visitors asked for a real encyclopedia and a feed that is already full, then grows a little each day.

## What Changes

- Expand the 医典 catalog to **at least 50** sourced encyclopedia articles (CN + EN), same schema and not-medical-advice rules. The 医典 dock lists all of them. Wiki stays **in-app GET** (no `wikipedia.org` `<a>`).
- Make 拉榜 a **full feed**: empty-store seed **and** any locale whose stored archive is still under 50 MUST top up to **≥50 unique** trend cards (titles unique per locale). Reuse the existing local trend JPEG pool (cycle is fine). Still no `<video>`, no Douyin.
- Keep **daily keep-and-append**: about **two** new 拉榜 cards and **one** useful note per Asia/Shanghai day per locale, without wiping older rows (three-month prune unchanged).
- Do **not** invent a daily 医典 generator. 医典 is a static catalog of ≥50; “a little more every day” is the 拉榜 increment only.
- Isolation: `/lalem` only. No officer Navigation, Fridge Raid, or landing restyle. Do not merge luxury gold PR #104.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed`.

### Modified Capabilities

- `lalem-page`: 医典 list has ≥50 articles; 拉榜 list shows the full stored feed (≥50 after seed/top-up) with compact thumbs; in-app wiki and fun-dark chrome stay.
- `lalem-loo-feed`: Digest GET returns ≥50 unique trends after seed or top-up; daily increment still appends ~2 trends + 1 useful; canned fallback pack has ≥50 unique titles; live seed that returns fewer than 50 is padded, never replacing the archive.

## Impact

- Frontend: `Lalem.tsx` already maps `articles` / `digest.trends`; tests assert 医典 count ≥50 and 拉榜 row count ≥50 after a seeded digest fixture. Bump `hardDataUrls.ts` stamp.
- Backend: `lalem_medicine.json` grows to ≥50; canned trends + seed/top-up in digest advise/handlers/store; prompt seed cap rises (live model may return fewer — pad from canned). Wiki GET unchanged.
- Render: frontend path filter on catalog/UI tests; backend on JSON + Go digest.
