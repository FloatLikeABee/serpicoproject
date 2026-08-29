## Purpose

Fleet map pins load from and save to the server while remaining usable from on-device cache during slow or failed sync, without treating the first timeout as a permanent outage.

## ADDED Requirements

### Requirement: Patient pin list with retry

When the Fleet map loads pins from the server, the client SHALL wait at least as long as the app health check waits for a cold backend, and SHALL retry the list request after failure instead of stopping after a single timeout. The hard outage message SHALL NOT appear after only the first failed list attempt.

#### Scenario: Backend still waking on first open

- **WHEN** the officer opens Fleet while the backend is waking and the first list request times out
- **THEN** the map keeps locally cached pins (if any) and retries the list instead of immediately showing a hard “server sync unavailable” outage

#### Scenario: List succeeds on a later attempt

- **WHEN** a list retry succeeds after an earlier timeout
- **THEN** the Fleet map shows the merged pin set and does not leave a hard outage message on screen

### Requirement: Sync status copy

Fleet SHALL distinguish connecting / retrying from a still-offline state. A still-offline message MUST state that pins remain on this device and will sync when the server is up. It MUST NOT claim the server is permanently unavailable after a transient failure.

#### Scenario: Retrying after a timeout

- **WHEN** the first list request fails and a retry is still in progress
- **THEN** the officer sees a connecting or retrying status, not a hard outage

#### Scenario: All list attempts failed

- **WHEN** list retries are exhausted without a successful response
- **THEN** the officer sees that pins are kept on this device and will sync when the server is up

#### Scenario: Successful write clears offline status

- **WHEN** a pin create or update succeeds after a list failure
- **THEN** the still-offline list message is cleared

### Requirement: Merge local unsynced pins with the server list

A successful server list MUST merge with on-device pins. Pins that exist only locally SHALL remain. When the same pin id exists in both sets, the server copy SHALL win. The client MUST NOT replace the entire local cache with an empty server list when unsynced local pins exist.

#### Scenario: Empty server list with local unsynced pins

- **WHEN** list succeeds with no markers and the device has unsynced local pins
- **THEN** those local pins remain visible on the map

#### Scenario: Same pin id on server and device

- **WHEN** list succeeds and a pin id exists both remotely and locally
- **THEN** the map shows the server version of that pin

#### Scenario: Server-only pins appear

- **WHEN** list succeeds with pins that are not in the local cache
- **THEN** those server pins appear on the map

### Requirement: Pin writes still persist locally on failed sync

Dropping, editing, or deleting a pin SHALL still update the on-device cache immediately. A failed create or update MUST NOT remove the local pin. A failed delete MUST tell the officer the server delete did not complete.

#### Scenario: Drop pin while server is down

- **WHEN** the officer drops a pin and the create request fails
- **THEN** the pin remains on the map and on this device

#### Scenario: Delete fails on the server

- **WHEN** the officer deletes a pin that was previously synced and the delete request fails
- **THEN** the officer is told the pin could not be deleted on the server
