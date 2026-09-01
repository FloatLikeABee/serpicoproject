## Context

See `proposal.md`. Backend is Gin + SQLite on `DATA_DIR` (`serpico.db`). Render exposes one HTTPS port for `serpico-backend`; it cannot publish a public MQTT TCP 1883 port. Frontend `App.tsx` only has `/login` public; everything else is `ProtectedRoute`. Existing `/admin/collection` crawls URLs into RAG — that is not hard data.

## Goals / Non-Goals

**Goals:**

- One SQLite table for ingested facts.
- Same write path for MQTT and HTTP.
- MQTT reachable from browsers/partners via WebSocket on the existing backend URL.
- Unlisted `/x-hard-data` page with copy-paste examples and a live POST/list demo.

**Non-Goals:**

- Nav, Login, or Dashboard links to the page.
- Feeding hard data into live AI/RAG in this change.
- Auth tokens / API keys for ingest (obscurity of the path only; revisit if abused).
- Chase Game revival.
- A separate Mosquitto/Render service.

## Decisions

### 1. Embedded MQTT over WebSocket on the Go process, not a sidecar broker

Use an in-process MQTT broker (e.g. mochi-mqtt or equivalent) mounted on the Gin/HTTP server at `/mqtt` (WebSocket). The same process subscribes to `serpico/hard-data/#` and inserts SQLite rows. Partners publish to `wss://<backend-host>/mqtt` with topic `serpico/hard-data/...`.

- **Why:** Render only gives HTTP(S). “Call MQTT directly” still works from Node, Python paho, or mqtt.js.
- **Alternative considered:** External HiveMQ/EMQX URL via env. Optional later (`MQTT_BROKER_URL`); v1 is embedded so demo works after deploy with no extra account.
- **Alternative considered:** TCP 1883. Rejected on Render.

### 2. HTTP API is a first-class twin, not a fallback-only shim

`POST /api/v1/hard-data` and `GET /api/v1/hard-data` share the insert/list functions used by the MQTT handler. Demo page uses HTTP so it works even if a partner’s MQTT client is misconfigured.

- **Why:** User asked for API *or* MQTT.
- **Alternative considered:** HTTP-only. Rejected; MQTT is required.

### 3. Hard data table is append-only facts

Schema: `id`, `topic`, `payload`, `source` (`mqtt`|`http`), `received_at`. Payload is TEXT (JSON or plain). List last N (e.g. 50). No update/delete in v1.

- **Why:** “Hard data” = durable as-received.
- **Alternative considered:** Merge into `cases`/`investigation_notes`. Rejected; those are officer-authored, not partner ingest.

### 4. Hidden page is a public React route outside ProtectedRoute

Register `/x-hard-data` next to `/login` in `App.tsx`. Do not add to `Navigation.tsx`. No login. Production URL is the frontend origin + `/x-hard-data` (e.g. `https://<serpico-frontend>/x-hard-data`). The page calls `REACT_APP_API_URL` for POST/GET and shows the MQTT WebSocket URL derived from the API host.

- **Why:** User asked to tell them the URL, not put it in current UI; others must open it without `serpico` / `cops123`.
- **Alternative considered:** Backend-served static HTML. Possible, but SPA rewrite already sends unknown paths to `index.html`; a React page matches the rest of the app.

### 5. Default topic prefix `serpico/hard-data`

Documented on the hidden page. Wildcard subscribe `serpico/hard-data/#`. HTTP default topic `serpico/hard-data/http`.

## Risks / Trade-offs

- **[Open ingest / spam]** → Mitigation: unlisted URL only in v1; add a shared token later if needed.
- **[MQTT WS path vs SPA rewrite]** → Mitigation: MQTT WS lives on **backend** host (`/mqtt`), not the static frontend.
- **[Payload size]** → Mitigation: reject bodies over a small cap (e.g. 32 KiB).
- **[CORS]** → Mitigation: existing API CORS; POST from the hidden page on the frontend origin must be allowed (already used for chat).

## Migration Plan

Deploy backend (table + MQTT + HTTP) then frontend (route). Rollback: omit routes; table can remain empty.

## Open Questions

None that block apply. Hidden path is **`/x-hard-data`**.
