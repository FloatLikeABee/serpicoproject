## Why

Admins can register a hardware serial to MQTT topic `serpico/hard-data/hw/{SERIAL}` and inspect its payloads, but the hardware owner has no URL of their own. Partners who already publish on that topic need a handle they can open to see **only** that device’s stored hard data.

## What Changes

- Each **registered** serial gets a public, unlisted handle derived from its MQTT topic. Example: topic `serpico/hard-data/hw/SN001` → page `https://serpico.onrender.com/x-hard-data/hw/SN001`.
- That page lists hard-data rows for **that topic only** (newest first): payload, source, topic, received time. Other devices’ topics MUST NOT appear.
- Unknown or unregistered serials MUST NOT show a data table (404 / not registered). Knowing a random topic that was never registered MUST NOT unlock a filtered dump.
- Officer nav and Login stay unchanged. The existing `/x-hard-data` docs+demo page stays. Admin registry and `/hardware/:id` stay.
- No officer demo login required (same as `/x-hard-data`). Knowledge of the handle is the access model for v1 (open ingest unchanged; no per-device tokens).

## Capabilities

### New Capabilities

- `hardware-topic-handle`: Unlisted per-serial URL for a registered hardware topic, showing only that topic’s hard-data list.

### Modified Capabilities

- None (`hardware-mqtt-registry` / `hard-data-ingest` are not archived under `openspec/specs/`).

## Impact

- Officer frontend: route `/x-hard-data/hw/:serial` (SPA 200 where possible), EN/zh like `/x-hard-data`, not in Navigation.
- Backend: public lookup by registered serial → topic-scoped messages (do not expose the unfiltered `GET /hard-data` list on this page).
- Admin SPA: optional copy-link to the owner handle after register; not required for the owner page to work.
- MQTT ingest and `hardware_registry` table unchanged.
