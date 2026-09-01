## Why

Partners and devices publish MQTT hard data onto a shared prefix, but admins have no way to bind a hardware serial number to a dedicated topic or to inspect only that device’s received payloads. Registry plus a per-topic table is needed so each unit gets a topic and admins can test/list its MQTT data.

## What Changes

- Admin (existing admin SPA, behind admin login) can register a hardware serial number and receive a unique MQTT topic under `serpico/hard-data/`.
- Re-registering the same serial returns the same topic (idempotent). Serials are unique.
- Admin can open a per-device test/data page: list hard-data rows for that topic, plus a test send that publishes to that topic so a new row appears.
- Admin dashboard gains a Hardware registry module. Officer app nav and `/x-hard-data` stay as they are (unlisted partner docs/demo unchanged).
- Backend stores registry rows in SQLite and can list hard data filtered by topic.

## Capabilities

### New Capabilities

- `hardware-mqtt-registry`: Admin registration of hardware serials to MQTT topics, and a per-topic test/data table of received hard data.

### Modified Capabilities

- None (`hard-data-ingest` is not archived under `openspec/specs/`).

## Impact

- Backend: `hardware_registry` table; admin HTTP APIs for register/list and topic-filtered messages; optional topic filter on hard-data list.
- Admin frontend (`serpico-admin.onrender.com`): registry page + per-device data table; dashboard tile.
- MQTT broker and SQLite `hard_data` ingest stay; assigned topics remain under `serpico/hard-data/#`.
- Officer frontend: no nav change. Hidden `/x-hard-data` unchanged.
