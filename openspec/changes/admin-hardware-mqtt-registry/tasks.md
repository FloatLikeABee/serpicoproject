## 1. Registry store

- [x] 1.1 Add SQLite `hardware_registry` (id, serial unique, topic unique, created_at) and verify a fresh `Initialize()`/`OpenSQLite` creates the table
- [x] 1.2 Add insert-or-get-by-serial (normalize trim/uppercase/`[A-Z0-9._-]+`, topic `serpico/hard-data/hw/{serial}`) plus list/get-by-id; verify new serial inserts, second insert returns the same row, empty/invalid serial errors

## 2. Admin APIs

- [x] 2.1 Add `POST /api/v1/admin/hardware` and `GET /api/v1/admin/hardware`; verify httptest 201 then idempotent 200 with the same topic, and 400 on empty serial
- [x] 2.2 Add `GET /api/v1/admin/hardware/:id` and `GET /api/v1/admin/hardware/:id/messages` (newest first, that topic only); verify MQTT-inserted hard data for that topic appears and a different topic does not
- [x] 2.3 Run `go test ./internal/database/ ./internal/api/ ./internal/mqttbroker/ -count=1` (or equivalent) and confirm pass

## 3. Admin UI

- [x] 3.1 Add dashboard module Hardware registry and routes `/hardware` (register form + device list) and `/hardware/:id` (topic, test payload, messages table) behind `ProtectedRoute`; verify unauthenticated visit redirects to `/login`
- [x] 3.2 On `/hardware/:id`, Publish MQTT test (QoS 1 to the assigned topic, production `wss://serpicoproject.onrender.com/mqtt` / local `mqttWsUrl`) then poll messages until the row appears; verify the table shows source `mqtt` and excludes other topics
- [x] 3.3 Confirm officer `Navigation.tsx` / Login have no hardware-registry link and `/x-hard-data` still exists (grep officer frontend for `/hardware` zero hits in nav)

## 4. Production check (after deploy)

- [ ] 4.1 On https://serpico-admin.onrender.com after admin login, register a serial, copy the topic, send a test MQTT payload, and verify the device table lists that `mqtt` row
