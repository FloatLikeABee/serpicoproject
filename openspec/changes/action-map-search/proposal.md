## Why

Officers drop pins with names, locations, and notes on the city map (today labeled Fleet) and on Pursue, but the only way to find a pin is to scan the map. As pin counts grow, they need a search bar that matches place names and note text. The desk itself should read as **Action**, not Fleet.

## What Changes

- Add a search bar on the Action (today Fleet) map header and on the Pursue map header.
- Typing in that bar filters the officer’s pins by place (name, address, kind) **or** notes (officer notes and AI brief text). Choosing a result pans the map to that pin and opens it.
- Rename every officer-facing **Fleet** label to **Action** (English) / **行动** (China). Bottom nav, ChaseHub tab, helper tab copy, chat greeting, and related aria labels.
- Keep internal APIs, file names, `/chase-game` routes, and `/fleet/markers` as they are. Accept `tab=action` as an alias of `tab=fleet`.
- Do **not** search Cases (`/notes`) timed notes. Do **not** revive Chase Game or the Pursue vehicle sim.

## Capabilities

### New Capabilities

- `map-pin-search`: Officers can search Action-map pins and Pursue map tags by place fields or note text, then jump to a matching pin.
- `action-desk-label`: Officer-facing Fleet chrome is labeled Action (US) / 行动 (CN).

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs for Fleet or Pursue maps).

## Impact

- Frontend: `FleetMap.tsx`, `InPursue.tsx`, map canvases (fly-to selected pin), shared search helper/UI, `ChaseHub.tsx`, `Navigation.tsx`, `i18n/catalog.ts` (+ tests), `chatMessages.ts`.
- No backend search endpoint; search runs on pins already loaded (Action: `fleetAPI.listMarkers` + cache; Pursue: `loadMapTags`).
- Demo login still uses `?userId=`.
