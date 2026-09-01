## Purpose

Lets partners ingest field facts into Serpico over MQTT or HTTP, persist them as hard data in local SQLite, and learn the integration from an unlisted docs-and-demo page.

## ADDED Requirements

### Requirement: MQTT messages are stored as hard data

The backend SHALL receive MQTT publishes on a documented topic (default `serpico/hard-data/#`) and persist each message in SQLite as hard data: id, topic, payload text, received_at. The payload SHALL be stored as received (not rewritten by the live AI model).

#### Scenario: MQTT publish is persisted

- **WHEN** a client publishes a UTF-8 payload to `serpico/hard-data/demo`
- **THEN** a hard-data row exists with that topic and payload and a received timestamp

#### Scenario: Hard data is not AI-rewritten

- **WHEN** a message is ingested via MQTT
- **THEN** the stored payload matches the published bytes/text and is not replaced by an AI chat fallback or RAG document

### Requirement: HTTP API ingest and list

The backend SHALL expose HTTP endpoints so callers can ingest the same hard data without MQTT, and list stored records. POST SHALL accept JSON with at least `payload` (optional `topic`, default `serpico/hard-data/http`). GET SHALL return recent records (newest first, bounded list).

#### Scenario: HTTP ingest

- **WHEN** a client POSTs `{ "payload": "unit 12 on scene", "topic": "serpico/hard-data/demo" }` to `/api/v1/hard-data`
- **THEN** the response is 201 with the stored record id, and GET `/api/v1/hard-data` includes that payload

#### Scenario: MQTT and HTTP share one store

- **WHEN** one record is published via MQTT and another via HTTP
- **THEN** GET `/api/v1/hard-data` returns both

### Requirement: Partners can publish MQTT directly

Callers SHALL be able to publish MQTT over WebSocket to the backend (same origin/host as the API), using the documented topic, without going through the officer UI. If MQTT is unavailable, HTTP ingest SHALL still work.

#### Scenario: MQTT over WebSocket

- **WHEN** a client connects to the backend MQTT WebSocket endpoint and publishes to `serpico/hard-data/demo`
- **THEN** the message is stored as hard data the same as HTTP ingest

#### Scenario: HTTP works without MQTT

- **WHEN** the MQTT listener is down or a client cannot use MQTT
- **THEN** POST `/api/v1/hard-data` still stores a record

### Requirement: Hidden docs and test demo page

The frontend SHALL serve an unlisted page at `/x-hard-data` that is not in Navigation and not linked from Login or the main dashboard. The page SHALL explain HTTP and MQTT usage (URL, topic, example payload) and SHALL include a test demo that posts a sample and shows recent hard-data records. The page SHALL be reachable without the officer demo login.

#### Scenario: Page is unlisted

- **WHEN** an officer uses the main app nav
- **THEN** there is no link to `/x-hard-data`

#### Scenario: Docs and demo

- **WHEN** someone opens `/x-hard-data` without logging in
- **THEN** they see how to POST and how to publish MQTT, can send a test payload, and see stored records listed
