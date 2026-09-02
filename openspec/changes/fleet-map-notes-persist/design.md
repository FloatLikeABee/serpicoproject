## Context

See `proposal.md`. Fleet drops a pin on map tap (`FleetMap` `handleMapClick`), opens `PlaceTagModal` in edit mode, and POSTs an empty-ish marker (`kind`, default name, coords, empty `notes`). Officer type/name/location/notes and Create AI info live in modal `draft` until `Save` calls `onChange` → `saveMarker` → `fleetAPI.updateMarker`. `onClose` (✕, backdrop, nav unmount) does not flush draft. `enrichWithAI` only `setDraft`. `fleet_markers` has `notes` but no AI brief column. `listMarkers` on remount `setMarkers` from the server and overwrites `localStorage`. `persistCreate` INSERT plus a concurrent `persistUpdate` that falls back to INSERT on the same id fails unique and can leave the empty first row. `syncTagLocation` can persist the original empty pin when geocode returns.

Pursue uses the same modal with device-only `saveMapTags`; it does not hard-replace from an API. Shared modal flush may help Pursue; do not change Pursue kinds.

## Goals / Non-Goals

**Goals:**

- Flush draft officer fields + AI brief on Save, close, and Fleet unmount.
- Persist AI brief with the pin and reload it.
- Idempotent create/update for a client pin id (`?userId=`).
- Geocode patches location only.
- Merge server list with device cache so remount does not wipe newer local fields.

**Non-Goals:**

- Redesigning pin types, AI prompt, or the Fleet map canvas.
- Account / nation changes.
- Reviving Chase Game.
- Cross-device conflict UI beyond last-write / newer-cache merge.

## Decisions

### 1. Flush the modal draft on close and unmount, not only Save

Call the existing persist path (`onChange` / `saveMarker`) when the officer taps Save **and** when the modal closes (✕, backdrop) **and** when Fleet unmounts with a dirty draft. Create AI info SHALL also persist the current draft (including `enrichment`) so generating AI is not a local-only side effect.

- **Why:** Officers treat filled fields + AI as saved; ✕ and bottom-nav unmount today discard `draft`.
- **Alternative considered:** Keep Save-only and add a warning. Rejected; the report is data loss, not missing copy.
- **Alternative considered:** Debounced persist on every keystroke only. Useful extra, not sufficient if unmount beats the timer.

### 2. Geocode / `onLocationUpdate` patches address (and lat/lng), never a full stale pin

`syncTagLocation` and modal reverse-geocode MUST merge onto the latest officer fields (prefer current `draft`, else latest marker), not `toFleetMarker(mappedEmptyPin)`. Persist that merged pin.

- **Why:** Auto-map starts from the drop-create tag; finishing after the officer typed notes currently POSTs/PUTs empty notes.
- **Alternative considered:** Disable auto-map until Save. Rejected; location auto-fill is wanted.

### 3. Upsert by client pin id on the server

`POST /fleet/markers` with an existing `(id, user_id)` SHALL update that row (SQLite `ON CONFLICT(id) DO UPDATE`) instead of failing unique. `PUT` stays the update path when the client knows the pin exists. Frontend `persistUpdate` should not INSERT as a fallback that can collide; wait for in-flight create or always upsert.

- **Why:** Drop-create and Save race on the same id.
- **Alternative considered:** Client queue (serialize all writes per id). Do that too if cheap; upsert is the source of truth so retries are safe.

### 4. Store AI brief on `fleet_markers` and round-trip it

Add a nullable `enrichment` TEXT (JSON `{ summary, fetchedAt }`) on `fleet_markers`. Include it on list/create/update JSON. Frontend `FleetMarkerPayload` and persist payloads send/receive it. Empty/missing JSON means no brief.

- **Why:** Remount `listMarkers` today cannot restore AI even after a successful Save of notes.
- **Alternative considered:** Device-only enrichment merge. Not enough once server list replaces cache.

### 5. Merge server list with device cache by pin id

After `listMarkers`, for each id: keep the version with the later `updatedAt`; if timestamps tie, prefer the copy that has notes/name/enrichment the other lacks. Never drop a local-only pin that has not synced yet (keep create retry).

- **Why:** Even with upsert, a slow save plus remount can still briefly see empty server rows.
- **Alternative considered:** Trust server only. That is the current wipe.

## Risks / Trade-offs

- **[Close-without-save now writes]** Closing after accidental type changes persists them → Mitigation: persist is what the user asked; Delete remains.
- **[Pursue modal close starts persisting]** Same `PlaceTagModal` → Mitigation: Pursue already treats `onChange` as upsert-to-localStorage; flush-on-close is consistent. Do not change Pursue kinds.
- **[SQLite JSON column]** Older DBs need `ALTER TABLE ... ADD COLUMN enrichment` in init → Mitigation: same pattern as other additive columns in `database.go`.
- **[Merge prefers stale local]** Clock skew → Mitigation: ISO `updatedAt` from save; bump on every flush.

## Migration Plan

Additive `enrichment` column; existing pins keep null. Rollback: revert frontend flush/merge; leftover column is unused.

## Open Questions

None that block apply. Fleet is the contract; shared modal flush may apply to Pursue without extra pin-type work.
