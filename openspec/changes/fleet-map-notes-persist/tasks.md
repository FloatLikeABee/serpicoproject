## 1. Server pin upsert and AI brief

- [ ] 1.1 Add nullable `enrichment` TEXT on `fleet_markers` (create + existing DB ALTER) and round-trip JSON `{ summary, fetchedAt }` on list/create/update; verify a Go test creates then lists a marker with notes and enrichment
- [ ] 1.2 Make `POST /fleet/markers` upsert on the client pin id for that `userId` so a second POST with the same id updates fields instead of unique-failing; verify a Go test POSTs empty notes then POSTs the same id with notes and GET returns the notes

## 2. Frontend persist path

- [ ] 2.1 Send and load `enrichment` on `fleetAPI` create/update/list and keep it on cached `FleetMarker`s; verify a unit test round-trips enrichment through the merge/cache helpers
- [ ] 2.2 Flush PlaceTagModal draft (type, name, location, notes, AI brief) on Save, close (✕/backdrop), Create AI info success, and Fleet unmount; verify a frontend test that filled fields survive close without tapping Save
- [ ] 2.3 Merge geocode/`onLocationUpdate` into the latest officer fields (location only) so a late map cannot persist empty name/notes; verify a test that typed notes remain after a stale geocode payload
- [ ] 2.4 Merge `listMarkers` with device cache by pin id (newer `updatedAt`, keep richer notes/enrichment, keep unsynced local pins); verify a test that remount with empty server + richer cache keeps the cache fields

## 3. Checks

- [ ] 3.1 Cover Save-after-AI and module-leave persistence with frontend tests (modal flush + Fleet merge); verify `npm test` for those files passes
- [ ] 3.2 Confirm Pursue pin kinds and Chase Game were not revived; grep that Fleet persist still uses `?userId=`
