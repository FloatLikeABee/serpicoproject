## 1. Action label

- [x] 1.1 Change catalog values `nav.fleet`, `chase.fleetTab`, and `helper.fleetTab` to Action (US) and 行动 (CN); add `map.search`, `map.searchEmpty` (and any needed `map.searchAria`) EN+ZH; verify `catalog.test.ts` expects Action / 行动 and the every-key-has-ZH test still passes
- [x] 1.2 Point ChaseHub tablist `aria-label` through `t()` (Action desk, not hardcoded Fleet) and treat `tab=action` like `tab=fleet`; verify a small ChaseHub/path test that `tab=fleet` and `tab=action` both select the pin map
- [x] 1.3 Update the `chase-game` AI greeting in `chatMessages.ts` from Fleet Desk to Action Desk; verify a chatMessages test (or existing matcher) that the greeting contains Action and not Fleet

## 2. Search matching

- [x] 2.1 Add `mapPinSearch.ts` with case-insensitive substring match on name, address, kind label, notes, and AI brief; empty query returns []; verify unit tests for name, notes, AI brief, kind label, empty query, and a pin in a different `cityId`
- [x] 2.2 Add `MapPinSearch` (input + results list, empty-state copy, Escape/clear) using the catalog search keys; verify a component test that typing a name shows that row and an empty query shows no list

## 3. Wire maps

- [x] 3.1 Place `MapPinSearch` in the Action (`FleetMap`) header, search all loaded markers (every city) with localized kind labels, and on select switch city if needed, fly to the pin, and open `PlaceTagModal`; verify a FleetMap test that a query matching notes lists the pin and selecting an out-of-city pin changes city and sets the active tag
- [x] 3.2 Place `MapPinSearch` in the Pursue (`InPursue`) header over `mapTags` only, fly to the selected tag, and open the modal; verify an InPursue test that Action pins / Cases notes are not in results and selecting a tag sets the active tag
- [x] 3.3 Add Leaflet `flyTo` on `focusPinId` in `FleetMapCanvas` and `PursuitMapCanvas`, sequenced after city change so city `flyTo` does not cancel the pin pan; verify a canvas/helper test or FleetMap test that focus of a pin in another city still targets that pin's lat/lng

## 4. Checks

- [x] 4.1 Run frontend tests for catalog, mapPinSearch, MapPinSearch, FleetMap/InPursue, and chatMessages and verify they pass
- [x] 4.2 Confirm `/fleet/markers` and `/chase-game` were not renamed, Chase Game / Pursue sim were not revived, and grep of officer-facing Fleet strings in nav/tab/greeting is gone (keys may still say `nav.fleet`)
