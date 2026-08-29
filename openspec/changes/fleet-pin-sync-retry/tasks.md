## 1. Sync helpers

- [x] 1.1 Add `frontend/src/utils/fleetSync.ts` with merge (remote overlays local by id; local-only kept), list retry (3 attempts, 45s-class timeout budget), and status copy (`Connecting to server…` / `Pins saved on this device. Will sync when the server is up.`); verify `frontend/src/utils/fleetSync.test.ts` covers empty-remote merge, same-id server-wins, retry-then-success, and copy strings
- [x] 1.2 Raise `fleetAPI.listMarkers` timeout to 45s and align create/update timeouts so a pin drop during wake can finish; verify the timeout constants match the health-check budget in `useHealthCheck.ts`

## 2. Fleet map wiring

- [x] 2.1 Wire `FleetMap` list load to retry + merge instead of replace-all; do not show a hard “server sync unavailable” after the first miss; verify cached pins remain visible while retries run
- [x] 2.2 Show connecting copy after a failed attempt while retries continue, offline copy after retries exhaust, and clear that banner on successful list or successful create/update; verify the old unavailable string is gone from `FleetMap.tsx`
- [x] 2.3 After a successful list, best-effort POST local-only pins and add them to synced ids; on tab visible while offline, re-run list; verify local-only pins are not dropped when remote is empty
- [x] 2.4 Keep local upsert on create/update/delete failure (existing write-local-first behavior) and keep the delete-failed server message; verify dropping a pin still leaves it on the map when create fails

## 3. Verification

- [x] 3.1 Run `CI=true npm test -- --watchAll=false` in `frontend` and confirm fleetSync (and existing) tests pass
- [ ] 3.2 Exercise Fleet in the browser: open map, confirm no hard outage on a warm API, drop a pin, switch city and back; if a browser is unavailable, curl `GET /api/v1/fleet/markers` and note the UI gap
