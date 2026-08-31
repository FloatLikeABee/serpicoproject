## Why

The Fleet bottom-nav icon is a tiny car drawn in the bottom of the 24×24 box, so it looks smaller than Pursue, Board, Chat, and Cases. In China mode, Fleet and Pursue (map notes) **tag type** chips and pin-modal type names are still English (`Officer`, `Staff`, `Investigation`, `Station / facility`, …) because those strings come from `MAP_TAG_KINDS` / `FLEET_MARKER_KINDS`, not the catalog.

## What Changes

- Redraw the Fleet nav icon so its graphic fills the same 20×20 visual weight as the other police nav icons (same `iconProps` box, larger centered vehicle).
- When nation is China, Fleet and Pursue tag-type chips, banners that interpolate `{kind}`, and pin-modal type labels SHALL be Simplified Chinese. United States stays English.
- Wire PlaceTagModal type dropdown / header kind label through `t()` (catalog already has `pin.type` / `pin.name` / `pin.notes` but the kind names and some field labels are still hardcoded).
- Officer-typed pin names and notes stay as stored; do not rewrite existing pins.

## Capabilities

### New Capabilities

- `map-tag-locale`: China-nation Fleet and Pursue map-tag type labels (chips, banners, pin-modal type) are Simplified Chinese; Fleet nav icon matches sibling icon size.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs; `account-nation` still lives as a change delta).

## Impact

- Frontend only: `Navigation.tsx` (Fleet SVG), `mapTags.ts` / `InPursue.tsx` (Pursue chips), `fleetMarkers.ts` / `FleetMap.tsx` (Fleet chips already partially catalogued), `PlaceTagModal.tsx` (kind `label`/`short`), `i18n/catalog.ts` plus catalog tests.
- No API, nation query, or Chase Game revival.
