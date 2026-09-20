# Design

## Context

See proposal.md — Why. Serpico already has three unlisted side apps (`/fridge-raid`, `/lalem`, `/shuileme`): public routes, isolated CSS worlds, JSON catalogs, in-lounge wiki, no officer Navigation. 肾结石快消散 copies that **arrangement** (one-thumb dock, photo sheets, CN default, unlisted, sequential real JPEGs, dedicated chat POST, nested `/…/chat` SPA copy) and **changes the subject** to kidney-stone knowledge, cases, and recovery. Isolation: `html.kx-world` / `.kx-*` vs `html.ll-world` / `.ll-*` vs `html.sm-world` / `.sm-*`. Wiki allowlist and SiliconFlow `CompleteFn` already exist. Luxury gold PR #104 stays out. Nested chat 404 on 睡了么 taught: register both the React route and `spa-routes.js` on day one.

## Goals / Non-Goals

**Goals:**

- Ship `/kuaixiaosan` and `/kuaixiaosan/chat` on the existing frontend + backend Render services.
- Six docks: 石 / 例 / 复 / 典 / 影 / 聊.
- Large local Commons/PD JPEG pack (unique hashes); sequential gallery; sourced encyclopedia.
- Feeling-and-recovery chat with canned fallback and thinking status.
- Isolation tests (`kuaixiaosanAbsence`) mirroring `shuilemeAbsence` / `lalemAbsence`.

**Non-Goals:**

- Folding this into `/lalem` or `/shuileme`, or a shared “lounge framework”.
- Sit-alert, companion bubble, 拉榜 digest, 睡了么 sound/wind-down, Notification API, `<video>`.
- Clinical diagnosis, prescribing doses, CBT, accounts, SQLite chat history, identifiable patient photos.
- A fourth Render service or officer-nav entrance.
- Merging PR #104 or archiving existing lounge changes.

## Decisions

### 1. Sibling app, not a 拉了么 or 睡了么 dock

**Choice:** New `Kuaixiaosan.tsx` at `/kuaixiaosan`, `html.kx-world`, `.kx-*`. Language key `serpico.kuaixiaosan.lang` (do not share 拉了么/睡了么 keys). Header kicker 快消散. Quiet 已看 clock. Header 好了 / I'm done freezes the clock in place.

**Rejected — seventh 睡了么 dock:** Mixing bedtime chrome with medical-encyclopedia density fails isolation.

**Rejected — parameterized lounge framework:** YAGNI. Three copy-paste cousins beat a premature abstraction.

### 2. Nested chat URL from day one

**Choice:** Public `<Route path="/kuaixiaosan/chat">` before `/kuaixiaosan` before `ProtectedRoute`. `spa-routes.js` entries `'kuaixiaosan'` and `'kuaixiaosan/chat'`. Dock sync like 睡了么: `dockFromPath` maps `/kuaixiaosan/chat` to `chat`; `goDock` `pushState`s `/kuaixiaosan/chat` vs `/kuaixiaosan`; `popstate` restores. Do **not** add GET on `POST /api/v1/kuaixiaosan/chat`.

**Rejected — chat dock only, no nested path:** User asked for in-app chat; 睡了么 already showed `/…/chat` 404s without the copy + route.

### 3. Six docks, photo-heavy

| Dock | Role |
| --- | --- |
| 石 stones | Composition / site / size-class museum of real stone specimens |
| 例 cases | Third-person typical vignettes (colic, ER, post-op, prevention) |
| 复 recover | Recovery steps by phase (acute, passing, post-lithotripsy, post-ureteroscopy, prevention) |
| 典 lore | Formation, diet, oxalate, uric acid, infection, procedures, anatomy encyclopedia |
| 影 imaging | CT/US/X-ray/anatomy/device photographs (PD/Commons, no identifiable faces) |
| 聊 chat | Feeling questions + recovery steps |

Filters (locked): stones `composition` `calcium-oxalate|uric|struvite|cystine|other`, `site` `kidney|ureter|bladder`, `sizeClass` `grit|small|staghorn`; cases `stage` `forming|colic|er|post-op|prevention`; recover `phase` `acute|passing|post-litho|post-ureteroscopy|prevention`; lore `topic` `formation|diet|oxalate|uric|infection|procedure|anatomy|tcm-encyc`; imaging `kind` `ct|us|xray|anatomy|specimen|device`.

### 4. Real photographs, never generated, never hotlinked

**Choice:** Package unique Wikimedia Commons / public-domain JPEGs under `frontend/public/kuaixiaosan/{stones,cases,recover,lore,imaging}/` with `ATTRIBUTION.md` (same table shape as 拉了么). Catalog `imageUrl` is a local path. Unique SHA-256 + JPEG SOI, no SVG leftovers, no duplicate bytes, no `://`. Reuse `queueLoungePhotos` on every gallery. Sheet heroes load eager when open.

Floors: ≥16 stones, ≥12 cases, ≥12 recover, ≥16 lore, ≥12 imaging.

**Rejected — AI-generated stones/kidneys:** User forbade generated images.

**Rejected — hotlink Commons:** Isolation + flaky CN. Same as 睡了么 beds.

**Rejected — identifiable patient photographs:** Privacy. Use specimens, models, devices, de-identified radiology that is clearly licensed, still-life of water/citrus/diet.

### 5. Chat: interview then recovery, never diagnose

**Choice:** `AdviseKuaixiaosanChat` + `POST /api/v1/kuaixiaosan/chat` JSON `{ locale, message, history?: [{role,text}] }` → `{ reply }`. Same SiliconFlow `CompleteFn`, trim ~800 runes (recovery needs more detail than sleepy math), history last 6, reject `you have` / `你患有`, ≥8 canned recovery lines per locale (each asks a feeling **or** names a step: sip water, strain urine, heat on the back, when to ER). Separate limiter `kuaixiaosanChatHits` (8 / 10 min). Do not persist. Frontend never calls `/lalem/*` or `/shuileme/*`.

Prompt: kidney-stone encyclopedia nurse-educator voice. First, if the user has not said where it hurts / fever / urine / post-op, **ask**. Then give numbered recovery steps. Always disclaimer. Fever + flank pain, anuria, pregnancy, vomiting that blocks fluids → “seek emergency care now” without naming a diagnosis. Off-topic → one stone/recovery paragraph.

Thinking: `.kx-think` `role="status"` `aria-live="polite"`, transcript `aria-busy`. Calm stone tokens, not `#7ee0ff` / `#c9f07a` / `#c6a56a`. Reduced-motion static.

**Rejected — reuse `/shuileme/chat` or `/lalem/chat`:** Voice clash (boring math vs funny poop vs recovery).

**Rejected — diagnose from symptoms:** Legal/medical; matches 医典 / 睡了么 lore hygiene.

### 6. Wiki and clinic sources

Reuse `parseLalemWikiURL` + wiki client in package `api`; public path `/kuaixiaosan/wiki`. Wikipedia = in-lounge button. NHS / Mayo / MedlinePlus / NIDDK / Cleveland Clinic MAY be outbound `https` `<a>` like 医典. Never `wikipedia.org` `<a>`.

### 7. Stone/water tokens

Inside `html.kx-world` only:

- `--kx-bg: #12181c`
- `--kx-surface: #1c262c`
- `--kx-text: #e4eef2`
- `--kx-muted: #8aa0aa`
- `--kx-accent: #5f9ea8`
- `--kx-warm: #c4a484`

Never `#c6a56a` / `#ff4d8d` / `#7ee0ff` / `#c9f07a`. Dock `repeat(6, minmax(0,1fr))`, 3-col wrap `<339px`. Sheets `.kx-sheet-hero` + `.kx-sheet-chip`. Large tap targets (≥2.75rem). `Array.from` for NodeLists; no iterator spreads.

### 8. Tests (TDD)

- Frontend: public `/kuaixiaosan` and `/kuaixiaosan/chat`; six docks; sequential `src` queue; sheets local JPEG; lore/case disclaimer and no diagnosis phrases; chat mock POST asks/steps + `role=status`; 好了 freezes 已看; no fetch to `/lalem/` or `/shuileme/`; no `video` / `Notification` / wikipedia `<a>` / `#c6a56a`; Navigation/Login/landing/HomeGate/FridgeRaid/Lalem/Shuileme have no `/kuaixiaosan`; spa-routes lists both paths.
- Go: catalog floors + unique JPEG hashes + local prefixes; lore/recover hygiene; wiki allowlist; `POST /api/v1/kuaixiaosan/chat` 200 `reply`; canned when no `CompleteFn`; diagnosis stripped; limiter independent.
- Isolation + stamp. `unset CI && npm run build`.

## Risks / Trade-offs

- **[Chat reads as a doctor]** → Prompt + reject/replace + disclaimer on 典/例/复/聊; tests ban diagnosis phrases and doses.
- **[Commons pack too thin for 68 unique photos]** → Prefer specimen/anatomy/device/diet stills; fail the unique-hash test rather than duplicate or generate.
- **[Nested path 404s on Render]** → spa-routes copy + React route before `/*`, same as `/shuileme/chat`.
- **[Six docks overflow]** → Same 6-col / 3-col wrap as 睡了么.
- **[PHI in “cases”]** → Invented typical vignettes only; no real names; no identifiable faces.
- **[Isolation bleed]** → Separate CSS world, absence tests against officer + both existing lounges.

## Migration Plan

Ship page + catalogs + photos + wiki + chat + nested route together. Rollback: revert route, `spa-routes` entries, CSS world, `/api/v1/kuaixiaosan` group, public JPEG pack. `/lalem` and `/shuileme` unchanged. No SQLite migration.

## Open Questions

None that block apply. Live model vs canned is already the 拉了么/睡了么 pattern.
