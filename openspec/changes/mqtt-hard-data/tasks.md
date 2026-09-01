## 1. SQLite hard data store

- [x] 1.1 Add `CREATE TABLE IF NOT EXISTS hard_data (id, topic, payload, source, received_at)` to `backend/internal/database/database.go` and verify a fresh `Initialize()` creates the table (unit test or sqlite inspect)
- [x] 1.2 Add insert + list helpers (append-only; list newest first, default limit 50; reject payloads over 32 KiB) and verify tests cover insert, oversized reject, and order

## 2. HTTP ingest API

- [x] 2.1 Add `POST /api/v1/hard-data` (JSON `payload` required, optional `topic` defaulting to `serpico/hard-data/http`, `source=http`) returning 201 with id; verify httptest 201 + GET includes the payload
- [x] 2.2 Add `GET /api/v1/hard-data` (newest first, bounded) and verify two inserts (MQTT-path helper + HTTP) both appear
- [x] 2.3 Reject empty/oversize POST with 400 and verify httptest; confirm payload is stored as-is (no AI rewrite)

## 3. MQTT receiver

- [x] 3.1 Embed an MQTT-over-WebSocket broker on the Go process at `/mqtt` (same HTTPS host as the API; not the frontend SPA) and verify a client can connect to `ws://localhost:<PORT>/mqtt`
- [x] 3.2 Subscribe in-process to `serpico/hard-data/#`, persist via the same insert helper with `source=mqtt`, and verify a publish to `serpico/hard-data/demo` creates a matching row
- [x] 3.3 Document `MQTT_TOPIC_PREFIX` / optional `MQTT_BROKER_URL` in `backend/.env.example` (defaults work with no extra account) and verify HTTP ingest still stores when MQTT attach is skipped/fails

## 4. Hidden docs + demo page

- [x] 4.1 Add public route `/x-hard-data` in `frontend/src/App.tsx` **outside** `ProtectedRoute` (sibling of `/login`) with a page that explains HTTP POST/GET and MQTT WS URL + topic, plus a live demo (POST sample, list recent); verify opening the path without login shows docs + demo
- [x] 4.2 Confirm `Navigation.tsx`, Login, and Dashboard have **no** link to `/x-hard-data`; grep nav/login for `x-hard-data` and verify zero hits

## 5. Integration verification

- [x] 5.1 Run `go test ./internal/database/ ./internal/api/ -count=1` (or equivalent package paths) and confirm pass
- [x] 5.2 Exercise POST then GET against local backend and the demo form; verify the listed record matches the posted payload and MQTT docs show `wss://<backend-host>/mqtt` + `serpico/hard-data/#`
