## Context

See `proposal.md` for motivation and `specs/lalem-page/spec.md` plus `specs/lalem-loo-feed/spec.md` for behavior.

Serpico’s public unlisted side-app pattern is `/fridge-raid` (翻冰箱) plus `/x-hard-data`: same React SPA, route outside `ProtectedRoute`, isolated CSS, no officer Navigation. Live text is SiliconFlow `deepseek-ai/DeepSeek-V4-Flash`. Officer `/chat` stays string-only. `spa-routes.js` must copy `index.html` for new static paths. Render filesystem is ephemeral.

Self-grill (locked, not open questions):

- **Same SPA or a new Render app?** Same SPA at `/lalem`. One deploy, same CORS, sibling of 翻冰箱. A third Render service is extra Blueprint for a phone page.
- **Rename 翻冰箱 to 吃了么?** No. User analogy only. Fridge Raid stays `/fridge-raid`.
- **Scrape Douyin / Weibo / TikTok for “real” trends?** No. ToS, copyright, Render-from-US flakiness, and China playback. Digest is a **daily SiliconFlow rewrite** of entertainment/fashion talking points, paired with **our** image/video pack. Feels recent; is not a piracy CDN.
- **YouTube embeds for 热片?** No for v1. YouTube is blocked or janky for the Chinese-default audience. Ship **muted looping mp4s** under `frontend/public/lalem/` (CC0 / original / clearly licensed) plus poster images.
- **Wikimedia hotlink for toilet photos?** Fragile. Ship a small **local image pack** (`frontend/public/lalem/toilets/…`) with an attribution file. Illustrated cards are OK if a photo license is unclear — every card still has an image.
- **User camera of the bowl?** Hard no. Gross, unmoderatable, not fun.
- **Medical stool coaching?** Hard no. Same wellness rule as Fridge Raid. 有用 is etiquette + don’t strain + wash hands + 别蹲太久 (ironic, since they opened a loo app).
- **Default language from `navigator.language`?** No. Product is a **default Chinese app**. First visit is `cn` unless `serpico.lalem.lang` or `?lang=en`.
- **Officer or landing link?** No. Unlisted URL, `lalemAbsence` test mirroring `fridgeRaidAbsence`.
- **Chat thread like Fridge Raid?** No. This is a **gallery + feed**, not a composer. Faster one-thumb use on the toilet.

## Goals / Non-Goals

**Goals:**

- Ship 拉了么 at `/lalem` on existing frontend + backend services.
- Museum-first: shape / size / class / history filters, image on every toilet.
- 热榜: entertainment + fashion cards with images, plus playable hot clips.
- 有用: short tips + disclaimer.
- Super-fun isolated skin; one-thumb dock; sit timer.
- Keep officer chat, Fridge Raid, and chrome untouched.

**Non-Goals:**

- Accounts, maps of nearby public toilets, reviews, occupancy IoT.
- Scraping social networks or hosting third-party copyrighted shows.
- Clinical GI advice, stool photos, Traditional Chinese.
- Officer-nav entrance or a new Render service.
- Renaming Fridge Raid.

## Decisions

### 1. Public `/lalem` on the existing SPA

Mount in `App.tsx` next to `/fridge-raid`. Isolated `.ll-page` / `html.ll-world` (拉了么), not `.fr-page` kitchen and not synth-grid. Bottom **lounge dock** (马桶 / 热榜 / 有用) is page-local, not `Navigation.tsx`. Add `lalem` to `spa-routes.js`.

- **Why:** Proven unlisted pattern. Bathroom use needs fat thumbs, not officer chrome.
- **Alternative considered:** `/la-le-me` or `/拉了么`. Rejected — ASCII path like `/fridge-raid`; title copy is 拉了么.
- **Alternative considered:** New Render static site. Rejected — extra service.

### 2. Three surfaces, museum is home

| Dock | Job |
| --- | --- |
| 马桶 | World + history toilet cards, filters, detail sheet |
| 热榜 | Entertainment/fashion image cards + 热片 video row |
| 有用 | Useful notes + disclaimer |

Remember last dock in `sessionStorage` `serpico.lalem.v1`. Language in `localStorage` `serpico.lalem.lang`.

- **Why:** User asked to “first hand” show toilets of the world; trends are the sit-and-scroll layer.
- **Alternative considered:** TikTok-style vertical only. Rejected — museum would drown.

### 3. Curated toilet JSON + local images, not a model encyclopedia

Backend (or frontend static module served through `GET /api/v1/lalem/toilets`) returns a catalog of ~24–40 toilets. Fields (names may match closely):

- `id`, `title`, `titleEn`, `blurb`, `blurbEn`
- `shape`: `sit` \| `squat` \| `urinal` \| `pit` \| `vacuum` \| `portable`
- `size`: `mini` \| `standard` \| `long` \| `accessible` \| `child`
- `class`: `home` \| `public` \| `transit` \| `palace` \| `lab` \| `luxury`
- `era`: e.g. `ancient` \| `roman` \| `imperial-cn` \| `victorian` \| `modern` \| `space`
- `region` short string
- `imageUrl` under `/lalem/toilets/...`
- `credit` attribution

Cover: 坐便 / 蹲便 / 尿斗 / 旱厕 / 火车真空 / 航马桶 / 宫殿 / 罗马公共厕所 / 日本 washlet / 无障碍. History is `era` chips on the same cards.

Detail sheet is local catalog text (fun, short). No live model on every card tap.

- **Why:** Images and history must be true enough to be a museum. A model will invent “Louis XIV gold bidet” without a picture.
- **Alternative considered:** Wikipedia proxy. Rejected — CORS, layout, not fun.
- **Alternative considered:** Generate every blurb live. Rejected — latency + quota on a filter-happy thumb.

### 4. Digest: cached SiliconFlow JSON + our media pack

`GET /api/v1/lalem/digest?locale=cn|en`

Response shape (names may match closely):

- `generatedAt`, `locale`, `disclaimer`
- `trends[]`: `kind` (`entertainment` \| `fashion` \| `other`), `title`, `hook`, `imageUrl`, optional `chips[]`
- `videos[]`: `title`, `posterUrl`, `srcUrl` (mp4 under `/lalem/videos/...`)
- `useful[]`: short strings

Prompt: JSON only; rank 娱乐 then 时尚; ban diagnose/prescribe; Simplified Chinese when locale=cn. Cap trends at ~8, videos at ~4, useful at ~6. At least ~70% of `trends` MUST be entertainment or fashion (prompt + server filter).

**Image pairing:** model returns `imageHint` or `kind`; server maps to a curated pool (`/lalem/trends/fashion-1.webp`, etc.). Do not trust model-invented URLs.

**Videos:** curated mp4s always present even if the model fails; on model failure return canned CN/EN copy + the same media.

**Cache:** in-memory, key `locale`, TTL ~1 hour. Rate limit ~8 / 10 min per IP (own bucket `lalem`, do not share fridge-raid quota).

Same `generateWithLiveModel` / DeepSeek-V4-Flash as Serpico text. No vision.

- **Why:** “Recent trends” without becoming a bootleg 抖音. Cache keeps the stall from burning tokens.
- **Alternative considered:** Live RSS mashup (Vogue, 娱乐 RSS). Optional later; v1 is model + pack so apply cannot block on flaky third-party HTML.
- **Alternative considered:** Bilibili oEmbed. Rejected for v1 — extra player chrome, blocked cookies, not one-thumb.

### 5. Fun skin and bathroom ergonomics

- Opening kicker: 「来都来了」 / title **拉了么**
- Sit timer (session elapsed), playful, not a medical “bowel duration log”
- Large chips, card images ~ 16:10, dock thumb-high
- Optional tiny water-drop SFX; **default muted**; never fart soundboards as a surprise (user can enable a joke sfx later — v1 skip)
- Color: night-market neon on warm tile, not navy synth, not kitchen orange clone
- Disclaimer on 有用 and in digest JSON

### 6. Isolation and tests

Mirror Fridge Raid: `lalemAbsence.test.ts` (no `/lalem` in Navigation/Login/HomeGate/Landing; `App.tsx` public route; spa-routes includes `lalem`). Page RTL: default CN title, filters, fixture toilets with images, 热榜 has a `video` element or playable source, 有用 disclaimer, no `navigation`. Go: catalog filters, digest fixture JSON, 429 burst, officer `/chat` unchanged.

## Risks / Trade-offs

- **[Digest is “AI slop”, not real hot news]** → Date in the prompt, canned fallback, entertainment/fashion filter, don’t claim 实时爬虫.
- **[Copyright on videos/images]** → Only pack we ship; attribution file; no scrape.
- **[Gross-out / underage bathroom humor]** → Adult-casual copy; no sexual content; no child-related toilet jokes in catalog.
- **[Model medical creep]** → Prompt bans + useful list is curated/canned mixed with model, strip diagnose words if needed.
- **[SPA 404 on Render]** → `spa-routes.js` `lalem` like `fridge-raid`.

## Migration Plan

Frontend + backend in one change. Rollback: unmount `/lalem` + unused routes. No data migration. No new Render env vars.

## Open Questions

None that block apply. Route is `/lalem`. Default locale is Simplified Chinese. Digest model is Serpico SiliconFlow live text. Media is local pack, not social scrape.
