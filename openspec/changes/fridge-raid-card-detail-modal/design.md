## Context

See `proposal.md` for motivation and `specs/fridge-raid-card-detail/spec.md` plus `specs/tcm-kitchen-dish-detail/spec.md` for behavior.

`/fridge-raid` is live: short colorful cards from `POST /api/v1/fridge-raid/chat`, collapsed `tcmNote`, isolated `.fr-page` flex layout (thread scrolls, composer in flow). Live text model is Serpico SiliconFlow `deepseek-ai/DeepSeek-V4-Flash`. Officer `/chat` stays string-only. Cards are scannable on purpose; stuffing a recipe into every card would break that.

Self-grill (locked, not open questions):

- **Why not put the recipe on the card?** Cards must stay one hook + chips. Detail is a second layer.
- **Why not generate all four recipes in the first chat call?** First paint would get slower and more expensive; most people will open at most one dish.
- **Why a modal, not `/fridge-raid/:dish`?** Keep the unlisted one-page app. No extra SPA route, no officer chrome, composer stays put when the sheet closes.
- **“What’s good for what” vs medicine?** Culinary TCM only (清热 / 开胃 / 化湿 / seasonal fit). Repeat the wellness disclaimer. Same rule as the original advisor spec.
- **Card click vs TCM expand?** The card opens the modal; the existing TCM control `stopPropagation`s so a peek does not also open the sheet.

## Goals / Non-Goals

**Goals:**

- Tap a suggestion card → beautiful kitchen modal with short cook steps + culinary TCM “good for”.
- Lazy live-model call on first open; session cache on reopen.
- Dedicated API; officer chat and short-card chat schema stay as they are.
- Same SiliconFlow live-model config as Serpico / fridge-raid text (no extra VL for this path).

**Non-Goals:**

- Nutrition databases, shopping lists, saved recipes, accounts, Traditional Chinese.
- Video, timers, or a full cookbook CMS.
- Clinical TCM diagnosis, herbal formulas, or “treats X disease”.
- Officer-nav entrance or a new Render service.

## Decisions

### 1. Lazy `POST /api/v1/fridge-raid/detail` — not baked into `/chat`

Request JSON (names may match closely): `{ locale, suggestion: { title, titleAlias, hook, chips, tcmNote, uses, need }, season, solarTerm, weather }`. No image. Server builds a fridge-raid-only prompt and returns structured detail JSON.

- **Why:** Chat stays fast and card-shaped. Detail can fail without blanking the thread.
- **Alternative considered:** One mega `/chat` payload with `details[]` for every suggestion. Rejected — latency, tokens, unused work.
- **Alternative considered:** Reuse officer `/chat`. Rejected — RAG/news/police primer; isolation already decided.

### 2. Structured detail payload, parsed like cards

Shape to implement:

- `title`, optional `titleAlias`
- `steps[]` (4–8 short strings)
- `tasteNote` (≤2 sentences)
- `tcm`: `{ nature, flavors[], goodFor[], caution[] }` — culinary strings only
- `disclaimer`, `locale`

Cap `steps` at 8 and each TCM list at ~6 after parse. Coerce string-or-array the same way fridge-raid cards already do. If parse fails: error + try again; do not dump the essay into the modal.

- **Why:** Specs require scannable lists. “Write a nice recipe” produces walls of text.
- **Alternative considered:** Markdown blob in the modal. Rejected — same essay failure mode as the first fridge-raid design.

### 3. Native-feeling overlay: `role="dialog"` kitchen sheet

Follow `CasesAccountButton` / `PlaceTagModal` a11y (`role="dialog"`, `aria-modal`, labelled by title, backdrop click, Escape, close button). Visuals are Fridge Raid only: warm paper, card accent stripe, rounded sheet.

Layout: **narrow** — bottom sheet covering ~90% height, scroll inside the panel, composer hidden underneath but restored on close. **Wide** — centered card, dimmed backdrop, max ~36rem.

Lock `body` scroll while open. Focus the close control or the dialog. Isolated `.fr-modal*` CSS (no synth-grid).

- **Why:** Matches “beautiful modal” and mobile thumbs; officer modals are navy and would clash.
- **Alternative considered:** `<dialog>.showModal()` only. Allowed if tests stay reliable; a div dialog is fine if jsdom is awkward.
- **Alternative considered:** Full new page. Rejected — loses thread context.

### 4. Card is the hit target; TCM toggle is not

`SuggestionCard` click (or Enter/Space when focused) opens the modal. The TCM expand `<button>` stops propagation. Chips and “uses/need” lines are part of the card hit target.

Nudge-only assistant bubbles (`askFridgeRaid` without suggestions) stay non-clickable.

- **Why:** One obvious “tell me more” affordance without fighting the existing peek.
- **Alternative considered:** Only a “详情” button. Weaker; the user asked to click the cards.

### 5. Session cache keyed by locale + title + uses

`sessionStorage` map `serpico.fridgeRaid.detail.v1` → `{ [key]: FridgeRaidDishDetail }`. Key = `locale + '\n' + title + '\n' + uses.join(',')`. Memory map in React is OK too as long as reopen in the same tab works.

- **Why:** Tapping the same card twice should not spend quota.
- **Alternative considered:** localStorage. Rejected — leftover recipes across days are not a goal.

### 6. Same live model + shared rate limit

`AIService` detail helper uses existing `generateWithLiveModel` / Qwen client (DeepSeek-V4-Flash, same key/URL, peer-host retry). Shared fridge-raid IP bucket (8 / 10 min) counts detail posts.

- **Why:** User already required Fridge Raid to share Serpico SiliconFlow config. Shared bucket is the abuse control we have.
- **Alternative considered:** Separate VL for “prettier” recipes. Rejected — no photo on this path; extra model ids drift.

### 7. Prompt: cook first, TCM second, no clinic

System primer: short method from `uses`/`need`; taste; then natures/flavors and `goodFor` as seasonal culinary effects; `caution` as food (cold salad in winter, heavy fry on a hot day). Ban diagnose/prescribe/cure. One locale.

Pass season/weather from the parent cards payload when present so detail matches the thread.

## Risks / Trade-offs

- **[Model still writes essays or medical claims]** → Strict JSON parse + length caps; prompt bans; disclaimer in modal; tests with a fixture, not live SiliconFlow.
- **[Clicking TCM also opens modal]** → `stopPropagation` on the peek control; RTL test that expanding TCM does not show the dialog.
- **[Modal covers composer / overlap regression]** → Overlay is `position: fixed` full viewport; thread layout unchanged; close restores composer.
- **[jsdom + native dialog]** → Prefer `role="dialog"` div tested like Cases account modal.
- **[Rate limit while browsing three cards]** → Cache hits do not count; first opens do. Acceptable; error copy already exists for 429.
- **[Stale cache if user switches language]** → Cache key includes locale.

## Migration Plan

Frontend + backend in one change. Rollback: hide card click + unused `/detail` route. No data migration. No new Render env vars.

## Open Questions

None that block apply. Modal is an overlay on `/fridge-raid`. Locale is EN / 简体中文. Detail model is Serpico SiliconFlow live text.
