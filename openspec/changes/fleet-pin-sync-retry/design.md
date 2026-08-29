## Context

See `proposal.md` for motivation. Fleet already lists/creates/updates/deletes markers at `/api/v1/fleet/markers?userId=` and caches them in `localStorage`. Production list works when the backend is warm. `useHealthCheck` already uses a 45s timeout for Render cold starts; `fleetAPI.listMarkers` uses 15s and has no retry. On list success, `FleetMap` currently replaces the entire local marker array with the remote payload.

## Goals / Non-Goals

**Goals:**

- Extract merge + retry + status copy into testable helpers so Leaflet does not need to be in unit tests.
- Align list timeout with the health-check timeout; retry a small number of times with backoff.
- Merge remote into local instead of replace-all.
- Keep using `?userId=` (not `X-User-Id`) for helper/fleet APIs.

**Non-Goals:**

- Render cron keep-alive or plan upgrades.
- Changing fleet marker schema, kinds, or city picker.
- Investigation Helper session sync (same timeout class, out of this change).
- Offline CRDT / conflict UI beyond last-write: server wins on same id.

## Decisions

### 1. Helpers in `frontend/src/utils/fleetSync.ts`, not a new backend

Retry, merge, and copy live next to `fleetMarkers.ts`. `FleetMap` calls them; `fleetAPI` only changes timeouts.

- **Why:** The production API already returns 200. The bug is client patience and merge policy.
- **Alternative considered:** Render cron ping. Rejected for this change (infra, does not help first-open timeout on a sleeping service by itself).

### 2. List timeout 45s, up to 3 attempts, short backoff

Match `useHealthCheck` (45s). Attempts: immediate, then retry twice after ~2s and ~4s (capped so a warm backend is not slow). Abort in-flight work on unmount / userId change.

- **Why:** One 15s miss is the screenshot. Health check already documented 45s as the cold-start budget.
- **Alternative considered:** Single 45s request with no retry. Weaker on a flaky cellular blip after the instance is up.

### 3. Status copy, not a single `syncError` string

States: `idle` (no banner), `connecting` (first attempt / retry in progress after a miss), `offline` (retries exhausted), cleared on successful list or successful create/update.

Copy:

- Connecting: `Connecting to server…`
- Offline: `Pins saved on this device. Will sync when the server is up.`
- Create/update fail: `Pin saved on this device. Server sync failed.` (keep; it is a write failure, not a false list outage)
- Delete fail: keep existing `Could not delete pin on the server.`

- **Why:** Spec forbids the hard “unavailable” line on first miss.
- **Alternative considered:** Hide all banners until retries exhaust. Connecting copy is better on a 45s wait.

### 4. Merge: remote by id overlays local; local-only kept

```
merged = { ...indexById(local), ...indexById(remote) }
syncedIds = ids from remote
```

After merge, persist cache. Pins in `syncedIds` use PUT on later edits; local-only still POST (existing `persistUpdate` path).

- **Why:** Empty remote after a cold start must not delete pins dropped while offline.
- **Alternative considered:** Never apply remote if local is non-empty. Would hide pins created on another device.

### 5. Visibility retry is optional follow-up, not required

If the officer stays on Fleet after `offline`, a later successful write already clears the banner. A `visibilitychange` / window `focus` re-list is useful but not required to meet the spec if mount retries already cover first open. Implement a single extra list when the tab becomes visible **only if** current state is `offline`, to clear a stale banner without extra load while connected.

## Risks / Trade-offs

- **[Longer hang on a truly dead API]** → Mitigation: connecting copy during wait; offline copy after 3 attempts; local pins still usable.
- **[Local-only pin never uploaded]** → Mitigation: existing create-on-edit path when id is not in `syncedIds`; list merge keeps the pin until a write succeeds. Optional: background flush of unsynced ids after successful list (do this if cheap: POST each local-only pin once after merge).
- **[Duplicate POST of local-only pins after merge]** → Mitigation: after successful list, attempt create for local-only ids (best-effort); add to `syncedIds` on success. If create fails, pin stays local. Unique id is client-generated (`flt-…`); server insert on same id may 500 — treat as already synced if conflict.
- **[Leaflet tests]** → Mitigation: unit-test helpers only; smoke Fleet in browser or curl is not a substitute for merge tests.

## Migration Plan

Frontend-only deploy (`serpico-frontend`). No SQLite migration. Rollback is revert the frontend commit; old clients keep replace-all + 15s timeout.

## Open Questions

None. Keep-alive cron deferred; same-id conflicts use server wins.
