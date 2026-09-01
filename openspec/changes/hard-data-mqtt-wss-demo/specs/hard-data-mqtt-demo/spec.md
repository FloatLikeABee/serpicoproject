## Purpose

Lets partners try MQTT ingest from the unlisted hard-data page by publishing over WebSocket, then seeing the stored row, without leaving the HTTP POST demo in place.

## ADDED Requirements

### Requirement: Live MQTT WebSocket demo on the unlisted page

The unlisted `/x-hard-data` page SHALL include a live demo control that publishes the entered topic and payload over MQTT on this environment’s WebSocket endpoint (the same host as the HTTP API, path `/mqtt`). Production SHALL use `wss://serpicoproject.onrender.com/mqtt`. The page SHALL still include the existing HTTP POST demo. The page SHALL remain reachable without officer login and SHALL NOT appear in Navigation, Login, or the main dashboard.

#### Scenario: MQTT publish control is visible without login

- **WHEN** someone opens `/x-hard-data` without logging in
- **THEN** they see both an HTTP sample send control and an MQTT WebSocket sample send control

#### Scenario: MQTT demo uses this environment’s broker

- **WHEN** the page is served against production
- **THEN** the MQTT demo publishes to `wss://serpicoproject.onrender.com/mqtt`
- **WHEN** the API base is localhost
- **THEN** the MQTT demo publishes to that environment’s `/mqtt` WebSocket URL (not a hardcoded production host)

### Requirement: MQTT demo stores hard data and lists it

Using the demo topic and payload fields, an MQTT WebSocket send SHALL result in a hard-data row with source `mqtt`. After a successful send, the page SHALL refresh the listed records so that row is visible with matching topic and payload.

#### Scenario: MQTT demo row appears with source mqtt

- **WHEN** a user sends payload `unit 12 on scene` on topic `serpico/hard-data/demo` via the MQTT demo control
- **THEN** the listed records include a row with that topic, that payload, and source `mqtt`

#### Scenario: HTTP demo still stores as http

- **WHEN** a user sends a sample via the HTTP demo control
- **THEN** the listed records include a row with source `http` and the same payload behavior as today

### Requirement: MQTT demo errors are visible in English and 中文

Connect or publish failures SHALL be shown on the page. English and 中文 labels SHALL exist for the MQTT send control and for those failures. Toggling 中文 SHALL still show 硬数据接入.

#### Scenario: Chinese toggle keeps MQTT demo labels

- **WHEN** the user selects 中文 on `/x-hard-data`
- **THEN** they see 硬数据接入 and a Chinese label for the MQTT sample send control

#### Scenario: Failed MQTT connect is reported

- **WHEN** the MQTT WebSocket connection or publish fails
- **THEN** the page shows an error and does not claim the sample was stored
