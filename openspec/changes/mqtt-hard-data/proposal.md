## Why

Partners need a way to push field facts into Serpico without using the officer UI. Today there is no MQTT intake and no public ingest API; collected content goes through admin RAG crawls, not a durable “hard data” store. We need a server-side receiver that persists payloads as-is and a hidden how-to page so others can publish over MQTT or HTTP.

## What Changes

- Backend MQTT receiver (subscribe to a documented topic) that writes each message into local SQLite as **hard data** (stored as received, not AI-rewritten).
- HTTP ingest/list API so callers can POST the same records without MQTT, and GET what was stored.
- Partners may publish **MQTT directly** (MQTT over WebSocket on the backend, same host as the API) or **call the HTTP API**.
- Hidden public page at **`/x-hard-data`**: not in Navigation, not linked from Login/Dashboard. Documents MQTT + HTTP usage and includes a live test demo (send a sample, see it listed).
- No change to existing police/civilian nav or Chase Game.

## Capabilities

### New Capabilities

- `hard-data-ingest`: MQTT + HTTP ingest of hard data into SQLite, list API, and an unlisted docs/demo page at `/x-hard-data`.

### Modified Capabilities

- None (no synced specs under `openspec/specs/` for ingest).

## Impact

- Backend: new SQLite table, MQTT subscriber/broker-or-client, Gin routes under `/api/v1/hard-data`, env for broker/topic; `render.yaml` / `.env.example`.
- Frontend: one public route `/x-hard-data` (outside `ProtectedRoute`), no nav entries.
- Production: `serpico-backend` must accept MQTT-over-WebSocket on the same HTTPS service (Render has no extra MQTT TCP port). HTTP ingest works even if MQTT is down.
