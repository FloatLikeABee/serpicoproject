# Design

## Context

See proposal.md — Why. 医典 is seven static JSON articles. 拉榜 persist-and-increment already exists: empty store seeds a live/canned digest (prompt cap 8, canned 4), then +2 trends +1 useful per Shanghai day. Production already has a short warm archive (~8). `ComposeStoredLalemDigest` returns the whole SQLite list (no 8-cap). `sanitizeLalemUseful` still truncates **generation** useful notes to 6; store GET does not. Trend JPEG pool is six local files; `RewriteLalemTrendImage` maps `.svg` leftovers to `.jpg`.

## Goals / Non-Goals

**Goals:**

- Static 医典 catalog ≥50 sourced articles, listed in full on the dock.
- Durable 拉榜 archive ≥50 unique titles per locale after seed or top-up, then +2/day.
- Reliable floor if the live model returns a short JSON batch (canned pad).
- Keep isolation, in-app wiki GET, no videos, existing prune and increment date bookkeeping.

**Non-Goals:**

- Daily generated 医典 articles or a second SQLite lore store.
- 50 useful notes (有用 stays +1/day).
- New trend photographs (cycle the existing six JPEGs).
- Pagination, virtual lists, or changing dock chrome/tokens.
- Raising the live-model token budget enough to require 50-card JSON in one completion.

## Decisions

### 1. 医典 stays a JSON catalog

Expand `backend/internal/ai/lalem_medicine.json` to ≥50 objects with the current fields (`id`, `title`, `titleEn`, `body`, `bodyEn`, `sources[]`). Keep existing seven ids. New ids kebab-case, unique. Topics stay toilet-adjacent encyclopedia (hygiene, fiber, water, IBS as general pages, pelvic floor, travel toilets, kids/elderly fixtures as lore—not personal advice). Each article: Wikipedia + one allowlisted clinic/WHO/NHS/Mayo/MedlinePlus URL. Frontend already maps `articles`; only tests and copy grow.

**Alternative:** Generate 医典 from the live model. Rejected: slower, undiagnosable quality, fights the “not a clinic” rule.

### 2. Canned trend pack of ≥50 is the floor

`cannedLalemTrends` (CN and EN) MUST contain ≥50 unique titles each, entertainment-first then fashion, bathroom-lounge tone. Seed/top-up: take live-model trends if present, then append canned titles whose title is not already in the locale store until `len >= 50`. `capLalemIncrementDigest` stays **2 trends / 1 useful** for the daily path only. Seed prompt cap may say “up to 50”; pad anyway.

**Alternative:** One live completion of 50 JSON cards. Rejected as the only path: models often return 8–15 and the current prompt cap is 8.

### 3. Top-up on GET when stored unique titles < 50

In `handleLalemDigest`, after prune and store read: if unique trend titles for the locale `< 50`, append padded cards (canned, plus optional one live seed batch) with `INSERT OR IGNORE` semantics, then compose. Do **not** treat top-up as the Shanghai daily increment (do not bump `last_increment_date` solely for top-up). If increment is also due the same request, run top-up first (or in one persist pass) so the day still adds ~2 extra unique titles on top of the floor.

Production’s existing ~8 rows MUST survive (append, never delete-and-reseed).

**Alternative:** Wipe the short archive and reseed 50. Rejected: loses the live 8 visitors already saw.

### 4. Images and wiki

Cycle `LalemTrendImagePool` `.jpg` paths. No new Commons download required. 医典 Wikipedia buttons keep using `openWiki` → `/lalem/wiki?url=`. Isolation tests still forbid `wikipedia.org` in `<a`.

### 5. Tests (TDD)

- Medicine catalog test: `len(articles) >= 50`, unique ids, each has wiki + allowlisted host, no `://` in unexpected image fields (医典 has no card image today—keep it that way unless already present).
- Canned trends: ≥50 unique titles per locale; pad helper reaches 50 from a 4-item live batch.
- Handler: empty DB seed GET ≥50 persisted; DB with 8 titles GET ≥50 and original titles remain; next Shanghai day +2 without dropping below 50.
- Frontend: 医典 dock renders ≥50 buttons; 拉榜 fixture with 50 trends renders 50 `.ll-trend img`; no `<video>`.
- Isolation + `hardDataUrls.ts` stamp bump.

## Risks / Trade-offs

- **[Live model still returns 8]** → Canned pad guarantees the floor; live cards remain first if unique.
- **[50 医典 bodies are tedious / medical-risk copy]** → Stick to general encyclopedia paraphrase + disclaimer; no diagnosis verbs; reuse overlapping Wikipedia/NHS URLs where the topic is the same cluster.
- **[Top-up races two GET]** → Same increment lock / single-flight already used for seed; reuse it for top-up.
- **[Long 拉榜 list on phones]** → 50 compact rows is acceptable; no virtualizer in this change.
- **[Useful still capped at 6 on live finishLalemDigest]** → Out of scope; store GET already returns the full useful archive.

## Migration Plan

Deploy backend first or together with frontend. First digest GET after deploy tops up each locale to 50. Rollback: revert JSON + handler; short archive remains valid. No SQLite schema change.

## Open Questions

None that block apply. 医典 does not grow daily; 拉榜 does.
