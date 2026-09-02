## Why

On Fleet, after an officer fills type, name, location, and notes and runs Create AI info, that pin content does not survive leaving Fleet. Switching to another module and coming back shows an empty or default pin. The typed fields live only in the modal draft until Save, AI never flushes, a create-then-update race can fail the server write, and remount always replaces local pins with the server list (which has no AI brief).

## What Changes

- Flush Fleet pin type, name, location, notes, and AI brief out of the modal so they persist when the officer Saves, closes the modal, or leaves Fleet.
- Stop geocode / location sync from overwriting officer-typed name, kind, notes, or AI brief.
- Make server create/update of the same pin id idempotent so an in-flight drop-create cannot lose a later save.
- Persist the AI location brief with the pin (not only in React state) and reload it when Fleet remounts.
- When Fleet fetches markers, merge with device cache instead of wiping newer local officer fields.

## Capabilities

### New Capabilities

- `fleet-map-pin-persist`: Fleet map pins keep type, name, location, notes, and AI brief across Save, modal close, and leaving/returning to Fleet.

### Modified Capabilities

- None (`openspec/specs/` has no synced main specs for Fleet pins).

## Impact

- Officer Fleet map: `FleetMap.tsx`, `PlaceTagModal.tsx`, `fleetMarkers.ts`, `fleetAPI` in `api.ts`.
- Backend `fleet_markers` + `fleet_handlers.go` (notes already exist; AI brief does not).
- Pursue uses the same modal; save-on-close / draft flush may apply there too if the modal API changes. Do not change Pursue pin kinds or revive Chase Game.
- Demo login still uses `?userId=`.
