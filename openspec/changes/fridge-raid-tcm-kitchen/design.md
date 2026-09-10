## Context

See `proposal.md` for motivation and `specs/fridge-raid-page/spec.md` plus `specs/tcm-kitchen-advisor/spec.md` for behavior.

Today the officer SPA owns almost every route under `ProtectedRoute` / `Dashboard` (synth-grid, bottom `Navigation`, navy/police theme). The only public unlisted pattern is `/x-hard-data` in `App.tsx`. Live chat (`POST /chat`) is text-only SiliconFlow (`deepseek-ai/DeepSeek-V4-Flash`); `qwenMessage.Content` is a string. Investigation Helper stores images on disk and does not actually vision-read them. i18n is `catalog.ts` with `en` / `cn` (Simplified). No main specs exist for this capability.

## Goals / Non-Goals

**Goals:**

- Ship a public one-page kitchen app at `/fridge-raid` using the existing frontend + backend services (not a third Render app).
- Keep officer chat, RAG, and chrome untouched.
- Return **structured cards** the UI can paint; do not hope markdown essays stay short.
- Use a **vision** model for fridge photos without persisting files.
- Inject season (and weather when lat/lon exists) in the server prompt, including a compact TCM primer so the model is not free-styling clinical claims.

**Non-Goals:**

- Officer-nav or landing entrance.
- Traditional Chinese, accounts, saved recipes, shopping delivery, nutrition-label databases, or a full TCM expert system / herbal pharmacy.
- Diagnosing or treating illness.
- Changing SiliconFlow’s default officer text model.
- A separate Render static site or admin UI.

## Decisions

### 1. Same SPA, public route — not a new service and not officer Chat

Mount `/fridge-raid` in `App.tsx` next to `/x-hard-data` (outside `ProtectedRoute`). New page component + isolated stylesheet. Dedicated `POST /api/v1/fridge-raid/chat`.

- **Why:** One deploy, SPA rewrite already covers unknown paths, unlisted-URL pattern already exists. The product is a URL, not a nav item.
- **Alternative considered:** New Render static site (`serpico-kitchen`). Rejected — extra CORS, env, and Blueprint for a single page.
- **Alternative considered:** Officer `AIChat` with a `fridge` context. Rejected — entrance would live inside Serpico; police chrome fights “colorful kitchen”; officer RAG/news would pollute prompts.

### 2. Structured JSON cards, rendered by the page

API JSON (shape to implement, names may match this closely):

- `season`, optional `solarTerm`, optional `weather` `{ label, tempC }`
- `ingredientsSeen[]`
- `askFridgeRaid` (bool) + optional `nudge` (short string)
- `suggestions[]` each: `title`, optional `titleAlias`, `hook` (≤2 sentences), `chips[]` (season / 开胃 / time), `tcmNote` (≤2 sentences, UI collapsed), `uses[]`, optional `need[]`
- `disclaimer` short string
- `locale`

Frontend paints cards + chips; **never** show the raw JSON or a long markdown blob as the primary view. If the model returns prose, parse fenced JSON; if parse fails, show a short error + “try again”, do not dump the essay.

- **Why:** Specs require scannable cards and length caps. Prompting “be brief” is not enough.
- **Alternative considered:** Markdown in officer `react-markdown`. Rejected — users will get stories; no reliable card chrome.

Client opening message is **canned** (i18n), not a live call, so the first paint works offline / without burning quota.

### 3. Separate vision client; do not widen officer chat messages

Add a fridge-raid-only SiliconFlow caller that sends OpenAI-style multimodal `content` parts (`image_url` data URL + text). Keep `QwenClient.GenerateResponse` string-only so officer chat cannot regress.

- Default vision model via env `FRIDGE_RAID_VISION_MODEL` (e.g. a Qwen2.5-VL / Qwen3-VL instruct id available on SiliconFlow). Text card generation may reuse the live text model **after** a vision pass that returns an ingredient list, or one VL call that returns the full JSON when an image is present.
- Preferred pipeline: **(a)** image → short ingredient list (VL) **(b)** ingredients + plan + season/weather → JSON cards (text model). One VL call that returns full JSON is allowed if it reliably honors the schema.
- **Why:** Current DeepSeek Flash is text; helper uploads already prove “image on file” without seeing pixels.
- **Alternative considered:** Reuse helper disk uploads. Rejected — durable photos on a public endpoint.

Caps: client canvas-compress to JPEG; API reject > 1.5 MiB or non-image. Process bytes in memory only.

### 4. Season table + Open-Meteo; no user weather essay

Server computes:

- Season from date; if `lat < 0`, invert.
- Approximate 24 solar terms from a static month-day table (north; invert label season in the south, keep term name only if it still makes culinary sense — prefer four-season + weather chips in the south).
- If `lat`/`lon` present: `GET` Open-Meteo current temp / weather_code / humidity / wind (no API key). Map to TCM climate chips: 寒 / 热 / 湿 / 燥 / 风. Timeout ~2s; on failure, season-only + `weatherUnavailable`.
- Geolocation is requested **on first send**, never on page load. User can deny.

- **Why:** TCM without season is cosplay; weather without a key keeps Render simple.
- **Alternative considered:** Ask the user “is it hot?” every time. Rejected as extra friction; keep as implicit fallback only when geo is denied.
- **Alternative considered:** Browser-side weather. Rejected — prompt assembly belongs on the server.

### 5. TCM as prompt primer + ranking rules, not a food database

Ship a compact system prompt (not a wiki):

- Four natures (寒热温凉), five flavors, seasonal correspondence (春养肝 / 夏养心 / 长夏化湿 / 秋润肺 / 冬温肾) at culinary granularity.
- Rank: **deliciousness first in the hook**; then appetite (酸/香 开胃), light nutrition, seasonal fit. TCM note is the expand.
- Forbidden: diagnose, prescribe herbs as medicine, “cure”, long dynastic stories.
- 2–4 dishes; prefer what is already in the fridge; `need[]` at most two pantry extras.
- Locale: one language for body copy.

No SQLite TCM graph in v1.

- **Why:** YAGNI. A stale database is worse than a constrained live model plus a primer.
- **Alternative considered:** Hand-authored recipe catalog. Rejected for v1 — fridge contents are unbounded.

### 6. Language toggle like HardDataDocs, not bilingual walls

Reuse `Nation` `en` | `cn`, `t()`, `detectNation` / `saveLastNation` (or a fridge-raid key so officer nation is not overwritten unexpectedly — prefer `serpico.fridgeRaid.lang`). `?lang=` / `?nation=` still work. Document `lang=zh-Hans` as `cn`.

- **Why:** Existing catalog pattern; specs forbid dual essays.
- **Alternative considered:** Always return EN+CN columns. Rejected — doubles reading time.

### 7. Session and abuse

- One thread in `sessionStorage` (`serpico.fridgeRaid.v1`). Clear resets to the canned fridge-raid ask. No backend session table.
- In-memory per-IP rate limit (e.g. 8 requests / 10 minutes) on the fridge-raid route only. 429 with a short localized message.
- No auth. Same public bar as `/x-hard-data`.

- **Why:** Side app should be instant; SQLite photos/sessions are a privacy and disk leak.
- **Alternative considered:** Invite-gated. Rejected — user asked for a separate URL, not Serpico accounts.

### 8. Visual system

Dedicated classes (e.g. `fr-page`, `fr-card`, seasonal accent). Palette shifts with computed season: spring greens, summer coral, late-summer earth, autumn gold, winter ink-blue. Colorful cards (distinct accent per suggestion). Typography: readable sans, generous spacing, large dish title. **Do not** import `synth-grid-bg`, `synth-scanlines`, or `Navigation`.

Mobile-first, one column, composer (text + camera) pinned at the bottom.

### 9. Tests (design-level)

- Frontend source test (same idea as `officerHardwareAbsence.test.ts`): `Navigation`, `Login`, landing/`HomeGate` have no `/fridge-raid`; `App.tsx` registers the public route outside `ProtectedRoute`.
- Page tests: greeting, EN/CN toggle, card render from fixture JSON, expand TCM, disclaimer.
- Go: size reject does not call vision; JSON unmarshal of fixture; locale in prompt; season inversion for negative lat; officer `/chat` prompt builder unchanged (no fridge-raid primer).
- Handler test with fake AI: leftovers → 2–4 suggestions; image-only + vision down → `askFridgeRaid`.

## Risks / Trade-offs

- **[Public unauthenticated LLM + images]** → Mitigation: size cap, rate limit, no disk, no officer RAG. Accept residual cost risk.
- **[Vision model id missing on SiliconFlow / 401]** → Mitigation: env-configurable model; fallback nudge to type leftovers; page still useful with text.
- **[Model ignores JSON / writes a novel]** → Mitigation: schema in prompt + parse; reject-and-nudge rather than render prose; unit-test parser with messy fences.
- **[TCM presented as medicine]** → Mitigation: primer + disclaimer + “culinary only” in spec; no herb-dose fields in the schema.
- **[Wrong hemisphere season]** → Mitigation: invert when `lat < 0`; default north only when geo denied.
- **[Open-Meteo down]** → Mitigation: season-only path; do not fail the whole chat.
- **[Police CSS leaks]** → Mitigation: page root class isolation; visual test that `Navigation` is absent.

## Migration Plan

Frontend + backend in one change. Rollback: revert route + API; leftover env vars are unused. No data migration. After merge, set `FRIDGE_RAID_VISION_MODEL` on `serpico-backend` if the default id is wrong for the live SiliconFlow account.

## Open Questions

None that block apply. Route is **`/fridge-raid`**. Locale is **en / 简体中文**. Vision is **SiliconFlow VL**, text cards may use the existing live text model after an ingredient pass.
