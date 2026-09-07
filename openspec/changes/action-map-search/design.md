## Context

See `proposal.md`. Action (today Fleet) is `ChaseHub` tab `fleet` rendering `FleetMap`: city select, kind chips, Leaflet `FleetMapCanvas`, pins via `fleetAPI` + device cache. Pursue is `InPursue`: kind chips, `PursuitMapCanvas`, tags in `localStorage` (`serpico.pursue.mapTags.v1.*`). Both open `PlaceTagModal` (name, address, notes, AI `enrichment.summary`). There is no search today. Officer-facing copy still says Fleet (`nav.fleet`, `chase.fleetTab`, `helper.fleetTab`, `chatMessages` `chase-game` greeting, ChaseHub `aria-label`).

## Goals / Non-Goals

**Goals:**

- One shared match helper and one shared search-field UI used by both maps.
- Client-side search over already-loaded pins (no new HTTP search).
- Fly-to + open modal on result select; Action may switch city.
- User-facing Fleet → Action without renaming Go files, React filenames, or `/fleet/markers`.

**Non-Goals:**

- Searching Cases timed notes.
- Server-side full-text search or ranking.
- Renaming `FleetMap.tsx`, `fleetAPI`, or SQLite `fleet_markers`.
- Reviving Chase Game / Pursue vehicle sim.
- Filtering the map to hide non-matching pins (results list only).

## Decisions

### 1. Shared `matchMapPins(query, pins)` plus a small `MapPinSearch` control

Put case-insensitive substring matching in a util (e.g. `mapPinSearch.ts`) over `{ id, name, address, notes, enrichment.summary, kindLabel, cityId? }`. Render a compact search input + result list (`MapPinSearch`) in each map header. Action passes all cached markers (every city) with city labels; Pursue passes `mapTags`.

- **Why:** Same fields and UX on both maps; one test file covers matching.
- **Alternative considered:** Duplicate filter logic in `FleetMap` and `InPursue`. Rejected; they already share `PlaceTagModal`.
- **Alternative considered:** Backend `GET /fleet/markers?q=`. Rejected; Pursue tags are device-only and Action pins are already in memory.

### 2. Results dropdown, not hiding other pins

While the query is non-empty, show up to a short list (about 8) of matches under the input (name, kind, optional city, snippet of notes). Tapping a row selects; Escape / empty query / backdrop click closes the list. The map still shows all pins for the current city.

- **Why:** Officers still drop new pins while searching; hiding pins would fight the tap-to-place flow.
- **Alternative considered:** Dim or hide non-matches on the map. Rejected for this change; can add later.

### 3. Select = switch city if needed, then flyTo, then open modal

Action: `setCityId(pin.cityId)` when different, pass `focusPinId` into `FleetMapCanvas` so a Leaflet helper `flyTo([lat,lng], zoom)` after city fly completes (or immediately if same city), then `setActiveTag(pin)`. Pursue: same flyTo on `PursuitMapCanvas` + `setActiveTag`. Debounce city `CityFlyTo` vs pin flyTo so the city animation does not cancel the pin pan (wait for city move, then fly to pin).

- **Why:** Search is useless if the officer still has to hunt the marker.
- **Alternative considered:** Only open the modal without panning. Rejected; they asked to find places on the map.

### 4. Rename is i18n + copy only; keep `tab=fleet`

Change catalog values: `nav.fleet`, `chase.fleetTab`, `helper.fleetTab` → Action / 行动. Add `map.search` / `map.searchEmpty` (or `fleet.search` / `pursue.search`) EN+ZH. Update `chatMessages` chase-game greeting. ChaseHub `aria-label` via `t()`. Keep i18n **keys** as `nav.fleet` to avoid a key migration. `tabFromPath` treats `tab=action` like `tab=fleet`.

- **Why:** Visible product language is what officers see; URLs and APIs are already bookmarked.
- **Alternative considered:** Rename keys, files, and `/fleet/markers`. Out of scope; large and breaking.

## Risks / Trade-offs

- **[City flyTo races pin flyTo]** → Mitigation: sequence with a short wait or `moveend` after city change; test that selecting an out-of-city pin ends on that pin.
- **[Header crowding on small screens]** → Mitigation: search is full-width under city select (Action) / under title (Pursue), same density as existing chips.
- **[Stale kind labels in search]** → Mitigation: match against `t(fleet.kind.*)` / `t(tag.kind.*)` at search time, not hardcoded English `label`.
- **[Chat greeting is not in the i18n catalog]** → Mitigation: keep EN greeting in `chatMessages.ts`; do not add a CN variant unless that file already localizes (it does not today).

## Migration Plan

Frontend-only. Rollback: revert search components and catalog string values. `tab=action` is additive.

## Open Questions

None that block apply. Cases notes stay out of this search; officers use Cases for those.
