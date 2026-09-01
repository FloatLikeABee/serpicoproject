## Purpose

Makes the unlisted hard-data docs page reachable at the real production frontend URL with a success HTTP status, and documents MQTT/HTTP ingest against the live backend host.

## ADDED Requirements

### Requirement: Canonical unlisted page URL

The documented production URL for the hard-data docs and demo page SHALL be `https://serpico.onrender.com/x-hard-data`. Deploy docs SHALL NOT present `serpico-frontend.onrender.com` as a working frontend host.

#### Scenario: Partner follows documented URL

- **WHEN** a partner opens the URL published for hard-data ingest docs
- **THEN** that URL is `https://serpico.onrender.com/x-hard-data` (or a documented successor of that same frontend service), not `serpico-frontend.onrender.com`

### Requirement: SPA paths return HTTP 200

A GET of `/x-hard-data` on the production frontend origin SHALL return HTTP 200 and the SPA shell so the React route can render without an HTTP 404. The same SHALL apply to other client-only paths such as `/login`.

#### Scenario: Hidden page is not an HTTP 404

- **WHEN** a client GETs `https://serpico.onrender.com/x-hard-data` without following a login
- **THEN** the response status is 200 and the body is the application HTML (not Render's plain-text `Not Found`)

#### Scenario: Login path also 200

- **WHEN** a client GETs `https://serpico.onrender.com/login`
- **THEN** the response status is 200

### Requirement: MQTT and HTTP examples use the live backend

The unlisted page SHALL show how to publish MQTT over WebSocket to `wss://serpicoproject.onrender.com/mqtt` on topic prefix `serpico/hard-data/#`, and how to POST/GET `https://serpicoproject.onrender.com/api/v1/hard-data`. Local/dev may still derive URLs from `REACT_APP_API_URL`.

#### Scenario: Production MQTT copy-paste

- **WHEN** someone opens `/x-hard-data` against production
- **THEN** they see `wss://serpicoproject.onrender.com/mqtt` and topic `serpico/hard-data/#` (or `serpico/hard-data/demo`) plus the HTTP API URL on `serpicoproject.onrender.com`
