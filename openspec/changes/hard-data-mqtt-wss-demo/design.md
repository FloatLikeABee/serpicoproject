## Context

See `proposal.md`. `/x-hard-data` (`HardDataDocs`) already shows MQTT copy-paste (`mqtt.connect` + `publish`) and a live **HTTP** form (`fetch` POST). `frontend` does not depend on an MQTT client today. Backend MQTT-over-WebSocket is live at `/mqtt` on `serpicoproject.onrender.com`; `CheckOrigin` already allows browser clients. MQTT insert is in-process after publish, so GET list may lag a short time.

## Goals / Non-Goals

**Goals:**

- One extra demo action on the existing form: publish MQTT over WSS, then refresh the list.
- Same topic/payload fields as HTTP POST.
- Local/dev uses `mqttWsUrl(REACT_APP_API_URL)`; production uses `wss://serpicoproject.onrender.com/mqtt`.

**Non-Goals:**

- New backend routes or SQLite schema.
- TCP 1883.
- Auth on ingest.
- Nav/login links.
- Subscribe UI (publish + list via HTTP GET is enough).
- Replacing the HTTP demo.

## Decisions

### 1. Browser MQTT client (`mqtt` npm) talking to existing `/mqtt`

Add the `mqtt` package to the frontend and call `mqtt.connect(wsUrl)` with protocol `wss`/`ws` from `mqttWsUrl` / `PROD_MQTT_WS`, then `publish` the form topic and payload as UTF-8. Disconnect after publish (or reuse one client per page session).

- **Why:** The how-to snippet already teaches `mqtt.js`; the demo should do what partners copy.
- **Alternative considered:** Raw `WebSocket` + hand-rolled MQTT packets. Rejected; fragile and diverges from docs.
- **Alternative considered:** Backend proxy `POST /hard-data/mqtt-demo` that publishes internally. Rejected; that would still be HTTP from the browser and would not prove WSS.

### 2. Two buttons, shared topic and payload

Keep **POST sample** (HTTP). Add **Publish MQTT** (WSS). Shared inputs. Distinct i18n keys (`hardData.send` stays HTTP; new `hardData.sendMqtt` / `hardData.mqttFail`).

- **Why:** User asked for an MQTT demo *as well*, not instead.
- **Alternative considered:** One button that tries MQTT then HTTP. Rejected; partners need to see each path.

### 3. Poll GET after MQTT publish until the row appears

After `publish` callback/QoS0 fire, poll `GET /api/v1/hard-data` for a few seconds until a matching `source=mqtt` row appears (or timeout with an error). Do not treat HTTP 201 as the MQTT success path.

- **Why:** MQTT persist is async relative to the browser.
- **Alternative considered:** Single GET immediately. Likely empty miss.

### 4. Tests mock the MQTT client

Jest cannot open live WSS in CI. Mock `mqtt.connect` to fire `connect` and capture `publish`, then mock GET returning a `source: mqtt` row. Keep existing HTTP POST button tests. Assert 中文 MQTT button label.

## Risks / Trade-offs

- **[mqtt bundle size]** → Mitigation: import only on this page (or dynamic import in the send handler).
- **[Cross-origin WSS from serpico.onrender.com]** → Mitigation: broker `CheckOrigin` already returns true; verify production click once after deploy.
- **[mqtt.js vs broker subprotocol `mqtt`]** → Mitigation: connect with `protocol: 'wss'` and default MQTT subprotocol; match the documented snippet if tests fail on handshake.
- **[Open ingest]** → Mitigation: unchanged; unlisted page only.

## Migration Plan

Frontend-only deploy. Rollback: revert the page/dependency; HTTP demo remains.

## Open Questions

None that block apply. Demo MQTT URL follows this environment (localhost `ws://…/mqtt`, production `wss://serpicoproject.onrender.com/mqtt`).
