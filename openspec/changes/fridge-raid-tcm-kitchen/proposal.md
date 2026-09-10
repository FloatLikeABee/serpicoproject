## Why

Serpico is an officer tool. A TCM fridge-raid kitchen advisor does not belong in that nav or visual language, but it should still ship from this repo as a tiny side app people can open on its own URL. Hungry users will not read essays; they need a few delicious, season-aware suggestions from whatever is already in the fridge.

## What Changes

- Add a **public one-page side app** at a dedicated frontend route (`/fridge-raid`). It is **not** an officer-app entrance: no link in Navigation, Login, Dashboard, or the public landing.
- The page is a simple AI chat. The assistant opens by asking the user to **fridge-raid** leftover food (type ingredients or upload a fridge photo). The user can also state a **cooking plan**.
- Suggestions are filtered and explained through **traditional Chinese medicine** (food nature, organ/season correspondence, current season and weather), while ranking for nutrition, wellbeing, appetite, and especially **deliciousness**.
- English and Simplified Chinese versions of chrome and replies (page language toggle). Traditional Chinese is out of scope.
- Replies are **short, colorful, card-based** — scannable chips and 1–2 sentence blocks, not long stories. TCM theory is a tap-to-expand note, not a lecture.
- Dedicated backend endpoint (vision + TCM prompt + season/weather). Photos are not stored. Wellness framing only (not medical advice).
- Isolated visual skin (warm seasonal kitchen). Officer synth/police chrome MUST NOT wrap this page.

## Capabilities

### New Capabilities

- `fridge-raid-page`: Unlisted one-page bilingual kitchen chat at `/fridge-raid` with text, photo, and cooking-plan input, rendered as short colorful suggestion cards.
- `tcm-kitchen-advisor`: Server-side advisor that reads fridge text/photos and optional plans, injects season/weather, and returns a few TCM-grounded dish suggestions in the page language.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs).

## Impact

- Officer frontend: new public route in `App.tsx` beside `/x-hard-data`; new page + isolated styles + i18n keys. No Dashboard/Navigation/Login/landing links.
- Backend: new `/fridge-raid` API (chat + optional image), SiliconFlow **vision** model for fridge photos (current live chat model is text-only), Open-Meteo (or equivalent) for weather when lat/lon is provided, TCM/season system prompt, structured suggestion payload.
- Render: SPA rewrite already covers new paths. May need a vision-model env var on `serpico-backend`. No new Render service.
- Abuse surface: public unauthenticated AI + images — size cap, no disk persistence, simple rate limit.
- Does not revive Chase Game, change officer chat, or add this app to the Serpico product shell.
