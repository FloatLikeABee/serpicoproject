## Why

Fridge Raid cards are meant to be scannable. Hungry people who tap a dish still need the next layer: how to cook it, and culinary TCM on what the dish is good for — without turning the thread into essays. That detail belongs in a beautiful modal, generated when they click, not dumped onto every card.

## What Changes

- Suggestion cards on `/fridge-raid` become tappable. Clicking a card opens a kitchen-styled modal for that dish.
- On open, the app asks the advisor for **cuisine detail** (short method) plus **traditional food-theory notes** (natures/flavors, seasonal “good for”, culinary cautions) in the page language.
- Existing collapsed TCM chip on the card stays a peek; it MUST NOT be replaced by stuffing a recipe into the card body.
- New dedicated backend call, separate from officer `/chat` and from the short-card `/fridge-raid/chat` payload.
- Wellness framing only: culinary / seasonal language, not diagnosis or treatment. Modal repeats the not-medical-advice line.
- Cache the generated detail in the browser session so reopening the same card does not burn another call.
- Isolated kitchen CSS (no officer synth modal). Mobile-first: large sheet; desktop: centered dialog.

## Capabilities

### New Capabilities

- `fridge-raid-card-detail`: Tappable suggestion cards open a beautiful kitchen modal with loading, cuisine steps, culinary TCM “good for”, close/ESC/backdrop, and session cache.
- `tcm-kitchen-dish-detail`: Dedicated fridge-raid detail advisor that returns structured dish method + culinary TCM payload from a suggestion card, using the same SiliconFlow live model as Serpico.

### Modified Capabilities

- None (`fridge-raid-page` / `tcm-kitchen-advisor` are not archived under `openspec/specs/`).

## Impact

- Frontend: `FridgeRaid.tsx` card click, new modal component, i18n keys, kitchen CSS; thread/composer layout stays non-overlapping.
- Backend: `POST /api/v1/fridge-raid/detail` (JSON card + locale + season/weather context); structured parse; same rate-limit bucket as chat; no photos on this path.
- Render: no new service. Same `SILICONFLOW_*` config as officer chat / fridge-raid text cards.
- Officer Navigation, Login, landing, and `/chat` stay untouched.
