## Why

Fleet shows a hard red “server sync unavailable” banner on first pin-list failure, even when the Render backend is only waking up. The 15s list timeout is shorter than the existing health-check timeout, there is no retry, and a later successful empty list would wipe unsynced local pins.

## What Changes

- Fleet pin **list** waits as long as the app health check (cold-start tolerant) and **retries** instead of failing once.
- First-failure copy is **not** a hard outage: pending vs still-offline vs synced.
- Successful remote list **merges** with local unsynced pins (same id: server wins; local-only pins stay) instead of replacing the whole cache.
- Create/update/delete keep working; timeouts align so a pin drop during wake can still persist.

## Capabilities

### New Capabilities

- `fleet-pin-sync`: Fleet map pin load/save against the backend, including retry, status copy, and merge of local unsynced pins with the server list.

### Modified Capabilities

- None (no existing specs under `openspec/specs/`).

## Impact

- Frontend: `FleetMap`, `fleetAPI` list timeout, new merge/retry helpers + tests.
- No backend route or schema change (production `/fleet/markers` already works).
- No Render cron / keep-alive in this change.
