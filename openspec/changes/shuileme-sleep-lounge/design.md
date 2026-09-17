# Design

## Context

See proposal.md — Why. Serpico already has two unlisted side apps (`/fridge-raid`, `/lalem`): public routes, isolated CSS worlds, JSON catalogs, in-lounge wiki, no officer Navigation. 拉了么 is a *stimulating* sit: timer, sit-alerts, companion, chat, 拉榜. 睡了么 copies the **arrangement** (one-thumb dock, photo sheets, CN default, unlisted) and **inverts the loops** so opening it in bed does not keep the visitor awake.

## Goals / Non-Goals

**Goals:**

- Ship `/shuileme` on the existing frontend + backend Render services.
- Five docks: 床 / 卧 / 典 / 声 / 息.
- Local image pack + sourced lore; generated Web Audio scenes; CSS wind-down.
- Isolation tests (`shuilemeAbsence`) mirroring `lalemAbsence` / `fridgeRaidAbsence`.

**Non-Goals:**

- Folding this into `/lalem` or sharing `.ll-*` tokens.
- Sit-alert, companion bubble, typed chat, 拉榜 digest, SiliconFlow, SQLite increment.
- `<video>`, YouTube/Douyin, Notification / `requestPermission`, luxury gold `#c6a56a`.
- Clinical insomnia treatment, CBT-I as therapy, melatonin dosing, accounts, sleep-stage sensors.
- A third Render service or officer-nav entrance.

## Decisions

### 1. Sibling app, not a 拉了么 dock

**Choice:** New `Shuileme.tsx` at `/shuileme`, `html.sm-world`, `.sm-*`. Language key `serpico.shuileme.lang` (do not share `serpico.lalem.lang`).

**Rejected — sixth 拉了么 dock:** Mixing toilet-fun chrome with bedtime dim fails isolation and keeps sit-alerts/companion on a sleep page.

**Rejected — parameterized “lounge framework”:** YAGNI. Two copy-paste cousins beat a premature abstraction.

### 2. Invert engagement (self-grill)

| 拉了么 (keep you sitting) | 睡了么 (let you sleep) |
| --- | --- |
| Sit-alert modals at 5/10 min | Quiet 已躺 clock only; no modal |
| Companion every 90s / 8 min | None |
| Typed chat | None in v1 (typing is arousal) |
| 拉榜 hot feed | None (news is arousal) |
| Cyan/lime pops `#7ee0ff` / `#c9f07a` | Moon navy + ember, never those pops, never `#c6a56a` / `#ff4d8d` |

Header MAY show elapsed-in-bed `已躺 m:ss` for orientation. It MUST NOT spawn a blocking overlay.

### 3. Sound: Web Audio, not a media CDN

**Choice:** `shuilemeSound.ts` builds looping `AudioBuffer`s (brown, pink, white-ish rain via filtered noise, fan via low oscillator + noise). Start on tap (`AudioContext.resume`). Stop on React unmount. Do **not** pause on `document.hidden` (phone face-down on the nightstand). No `<audio src="https://…">`, no `<video>`.

**Rejected — ship 20 MB of rain MP3s:** Render static budget + licensing. Generated noise is enough for v1 and unit-testable with a fake `AudioContext`.

**Rejected — YouTube/lofi embeds:** Blocked or janky for CN-default; also `<iframe>` stimulation.

Scenes (minimum): `brown`, `pink`, `rain`, `fan`. Optional extras (`waves`, `cricket`) if buffers stay tiny.

### 4. Visual wind-down: CSS, not video

**Choice:** Dock `rest` (`息`) renders `.sm-breathe` — a large slow-scale orb on a dim radial field. `@media (prefers-reduced-motion: reduce)` disables the animation and leaves a static glow. After ~8 minutes in this dock the field MAY dim further via opacity (no dialog, no shake).

**Rejected — looping mp4 night sky:** Spec forbids `<video>` (same isolation as 拉了么 after the video ban). CSS is smaller and respects reduced motion.

### 5. Catalogs: static JSON + local JPEGs, no live AI

**Choice:** `go:embed` `shuileme_beds.json`, `shuileme_rooms.json`, `shuileme_lore.json`. Routes:

- `GET /api/v1/shuileme/beds?size=&fill=&era=`
- `GET /api/v1/shuileme/bedrooms?light=&layout=`
- `GET /api/v1/shuileme/lore`
- `GET /api/v1/shuileme/wiki?url=` (reuse `parseLalemWikiURL` + wiki client in package `api`; public path stays `/shuileme/wiki`)

Floors: ≥8 beds, ≥8 bedrooms, ≥16 lore articles. Images under `frontend/public/shuileme/{beds,rooms,lore}/` with `ATTRIBUTION.md`. Illustrated originals / clearly licensed only.

**Rejected — SiliconFlow sleep digest:** User asked for knowledge + sound/visual, not another live feed. Adds rate limits and arousal copy. Can be a later change.

**Rejected — scrape sleep-app APIs / white-noise YouTube:** ToS and playback.

### 6. Museum fields (imagination, locked)

**Beds** (`fill` not toilet `shape`): size `single|double|king|kang-width`; fill `spring|foam|futon|kang|hammock|water|capsule|platform`; era `ancient|tang|edo|victorian|modern|space`. Example cards: 火炕, 罗汉床, tatami, four-poster, murphy, capsule, hammock, 火车卧铺.

**Bedrooms** (`light`, `layout`): light `blackout|dim|nightlight|day-shutters|moon`; layout `alcove|open|capsule|sleeper|kang-room|washitsu|tent|chamber`. Example cards: 黑房间, 竹帘午睡, 胶囊舱, 卧铺隔间, 蒙古包夜, 四合院耳房, 婴儿夜灯房, 北欧木屋.

**Lore** (encyclopedia): circadian / caffeine half-life / stimulus control / bedroom temperature / blue light / naps / 子午觉 / 失眠 as a word people use — **describe, do not diagnose**. Sources: Wikipedia + NHS / Mayo / MedlinePlus like 医典. Ban `you have`, `你患有`, benzos as “take this”.

### 7. Night tokens

Inside `html.sm-world` only:

- `--sm-bg: #0e1218`
- `--sm-surface: #1a2230`
- `--sm-text: #dce6f0`
- `--sm-muted: #8b9aab`
- `--sm-accent: #6b8fbf`
- `--sm-warm: #c9896a`

Dock `repeat(5, minmax(0,1fr))`, 3-col wrap `<339px`. Sheets use `.sm-sheet-hero` cover JPEG + `.sm-sheet-chip`. Large tap targets (≥2.75rem). `Array.from` for NodeLists; no iterator spreads.

### 8. Tests (TDD)

- Frontend: public mount, five docks, no textarea, no sit-alert at 5 min, bed/room/lore sheets + hero, sound tap starts (mocked AudioContext) / unmount stops, wind-down + reduced-motion, no `video` / `Notification` / wikipedia `<a>` / `#c6a56a` / `.ll-*` on this page; Lalem and Fridge Raid files still have no `/shuileme`.
- Go: catalog floors + filters + local image prefixes; lore hygiene; wiki allowlist.
- Isolation + stamp. `unset CI && npm run build`.

## Risks / Trade-offs

- **[Generated noise sounds cheap]** → Keep buffers long enough (~2s seamless loop) and label scenes honestly (“褐噪”, not “rainforest 8D”).
- **[AudioContext blocked]** → First tap is the only start; show “点一下开始” until running.
- **[Lore reads as medical advice]** → Disclaimer on 典 dock + sheet; reject diagnosis phrases in JSON tests.
- **[Bright UI keeps them up]** → Night tokens; no lalem cyan/lime; wind-down dims; no modal alerts.
- **[Wiki coupling to lalem helpers]** → Same `api` package helpers, separate URL prefix so clients never call `/lalem/*` from this page.
- **[Image pack missing]** → Same approach as 拉了么: generate original stills into `public/shuileme/` during apply; never hotlink Wikimedia.

## Migration Plan

Ship page + catalogs + wiki + sound/visual together. Rollback: revert route, `spa-routes` entry, CSS world, `/api/v1/shuileme` group. `/lalem` unchanged. No SQLite migration.

## Open Questions

None that block apply. Live sleep AI and a typed night chat stay out of this change on purpose.
