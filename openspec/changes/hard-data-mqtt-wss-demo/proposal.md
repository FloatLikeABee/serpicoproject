## Why

The unlisted `/x-hard-data` page already documents MQTT over WebSocket and has a live **HTTP POST** demo, but partners cannot press a button to publish over MQTT WSS and see `source=mqtt` in the list. A copy-paste snippet is not a demo; they need a working WSS send on the same page.

## What Changes

- Keep the existing HTTP “POST sample” demo (topic + payload → `POST /api/v1/hard-data`).
- Add a live **MQTT WSS** demo on the same page that connects to this environment’s `/mqtt` WebSocket (production: `wss://serpicoproject.onrender.com/mqtt`) and publishes the same topic/payload.
- After a successful MQTT publish, refresh the record list so the new row appears with source `mqtt`.
- English and 中文 labels for the MQTT demo control and errors.
- Page stays unlisted (no nav / login / dashboard link).

## Capabilities

### New Capabilities

- `hard-data-mqtt-demo`: Live MQTT-over-WebSocket publish demo on the unlisted hard-data page, alongside the existing HTTP POST demo.

### Modified Capabilities

- None (`hard-data-ingest` is not archived under `openspec/specs/`).

## Impact

- Frontend: `HardDataDocs` demo actions, i18n catalog EN+zh, `mqtt` client dependency (or equivalent) for browser WSS publish, tests for a visible MQTT publish control.
- Backend: no ingest/API change expected; broker already allows browser origins. Apply may add a short list-poll after publish if MQTT insert is not immediately visible on GET.
- Production: demo on https://serpico.onrender.com/x-hard-data talks to `wss://serpicoproject.onrender.com/mqtt`.
