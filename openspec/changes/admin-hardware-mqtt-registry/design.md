## Context

See `proposal.md`. Admin SPA is `admin-frontend` (live `https://serpico-admin.onrender.com`), client-gated with `adminAuth` like Users / RAG. Backend already persists MQTT/HTTP hard data in SQLite (`hard_data`) on `serpico/hard-data/#` via WSS `/mqtt`. List API has no topic filter. Officer `/x-hard-data` stays unlisted.

## Goals / Non-Goals

**Goals:**

- SQLite registry: serial → topic.
- Admin UI: register, list devices, per-device messages table + test send.
- Topics stay under the existing MQTT wildcard so ingest needs no new subscribe.

**Non-Goals:**

- Officer nav or login changes.
- Changing `/x-hard-data`.
- Per-device MQTT auth tokens (open ingest v1 unchanged).
- Chase Game revival.
- Chinese copy on admin (admin is English today).

## Decisions

### 1. Admin SPA module, not officer frontend

Dashboard tile **Hardware registry** → `/hardware` (list + register form) and `/hardware/:id` (table + test). `ProtectedRoute` like RAG.

- **Why:** User asked for an admin page; admin already has module cards.
- **Alternative considered:** Officer Board. Rejected; mixing partner ingest ops into field UI.

### 2. Topic `serpico/hard-data/hw/{normalized-serial}`

Normalize serial: trim, uppercase, allow `[A-Z0-9._-]+`. Topic suffix is that string. Unique index on serial and on topic.

- **Why:** Devices can be told the topic from the serial; still matches `serpico/hard-data/#`.
- **Alternative considered:** Random UUID suffix. Rejected; harder for hardware to configure.
- **Alternative considered:** Topic = serial only. Rejected; keep the hard-data prefix so the broker filter stays one subscribe.

### 3. APIs under `/api/v1/admin/hardware`

- `POST /admin/hardware` `{ "serial": "SN-1001" }` → 201 or 200 with `{ id, serial, topic, createdAt }` (idempotent).
- `GET /admin/hardware` → list.
- `GET /admin/hardware/:id` → one device.
- `GET /admin/hardware/:id/messages` → hard_data rows where topic equals that device’s topic (newest first, bounded).

Match existing admin APIs (no new token middleware).

- **Why:** Same trust model as `/admin/users`.
- **Alternative considered:** Filter only via `GET /hard-data?topic=`. Still add that helper internally; admin path is clearer for the UI.

### 4. Test send uses MQTT WSS to the assigned topic

Reuse the frontend `mqtt` client (or admin copy of the helper) against `mqttWsUrl(API)` / production `wss://serpicoproject.onrender.com/mqtt`, QoS 1, then poll messages until the row appears (same pattern as `/x-hard-data`).

- **Why:** User asked to test MQTT-received data for that topic, not only HTTP twin.
- **Alternative considered:** HTTP POST `/hard-data` with the topic. Useful fallback if MQTT fails; primary control is MQTT.

### 5. Data table is topic-scoped, all sources shown, MQTT visible

Show source column so MQTT vs HTTP is obvious. Do not include other topics.

## Risks / Trade-offs

- **[Open ingest]** → Mitigation: unlisted partner page + admin-only registry UI; tokens later if abused.
- **[Serial collision after normalize]** → Mitigation: unique index; tell the admin the existing topic.
- **[Admin SPA vs live hostname]** → Mitigation: `serpico-admin.onrender.com`; `admin-frontend/**` path filter on Render.

## Migration Plan

Deploy backend (table + routes) then admin frontend. Rollback: hide dashboard tile; table can remain.

## Open Questions

None that block apply. Topic pattern is **`serpico/hard-data/hw/{NORMALIZED_SERIAL}`**. Live admin host is **https://serpico-admin.onrender.com**.
