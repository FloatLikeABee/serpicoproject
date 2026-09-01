## Context

See `proposal.md`. Admins already bind serial → topic `serpico/hard-data/hw/{SERIAL}` (`hardware_registry`) and list messages via `GET /api/v1/admin/hardware/:id/messages`. Officer `/x-hard-data` is unlisted docs+demo and currently lists **all** recent hard data. `GET /api/v1/hard-data` is unfiltered. Owner needs a handle keyed by serial, not admin UUID.

## Goals / Non-Goals

**Goals:**

- Public (no officer login) unlisted page per registered serial.
- Backend lookup that 404s if the serial is not registered, then lists that topic only.
- SPA route before the officer `ProtectedRoute` catch-all.

**Non-Goals:**

- Per-device auth tokens or mapping Serpico officer `userId` to serials.
- Changing MQTT ingest, admin register APIs, or putting handles in officer nav.
- MQTT/HTTP test publish on the owner page (admin device page already has Publish MQTT).
- Changing `/x-hard-data` docs/demo behavior (it may keep showing the global demo list).

## Decisions

### 1. Handle URL is `/x-hard-data/hw/:serial` on the officer frontend

Production: `https://serpico.onrender.com/x-hard-data/hw/SN001` for topic `serpico/hard-data/hw/SN001`. Normalize the path serial the same as registry. EN/zh toggle like `/x-hard-data`.

- **Why:** User asked to visit by the topic handle; the path after `serpico/hard-data/` is `hw/SN001`. Stays next to the existing unlisted partner page.
- **Alternative considered:** Admin `/hardware/:id`. Rejected; UUID is not the MQTT handle and requires admin login.
- **Alternative considered:** Officer login + `?userId=`. Rejected; hardware partners are not demo officers.

### 2. Public API `GET /api/v1/hard-data/hw/:serial`

Normalize serial, require a `hardware_registry` row, then `ListHardDataByTopic` for that topic. 404 if missing/invalid. Do not accept an arbitrary `?topic=` that would leak unregistered topics.

- **Why:** Serial is the handle; admin `:id` is the internal UUID.
- **Alternative considered:** Reuse `GET /hard-data?topic=`. Rejected as the owner endpoint unless registration is enforced; unfiltered list must not be used by this page.

### 3. SPA hosting for nested `/x-hard-data/hw/:serial`

Add React route `/x-hard-data/hw/:serial`. spa-routes: copy `x-hard-data/hw/` (prefix) plus existing `x-hard-data`; keep `404.html` shell. Render `/*` rewrite on `serpico` remains the real 200 for dynamic serials.

- **Why:** Same constraint as `/x-hard-data` HTTP 200 on Render.

### 4. Admin shows the owner URL (copy)

On admin register success / device page, show `https://serpico.onrender.com/x-hard-data/hw/{SERIAL}` so operators can give partners the handle. Not a second registry.

- **Why:** Otherwise partners only know the MQTT topic, not the HTTP path.

## Risks / Trade-offs

- **[Handle secrecy]** Knowledge of serial = read access to that topic’s store → Mitigation: unlisted URL; 404 for unregistered serials; tokens later if abused.
- **[Global GET /hard-data still lists everything]** Owner page MUST NOT call it → Mitigation: dedicated `/hard-data/hw/:serial`.
- **[Dynamic SPA 404]** Nested serial path may 404 without rewrite → Mitigation: spa-routes prefix + 404.html + live `serpico` rewrite.

## Migration Plan

Deploy backend route first (404 until registry has the serial), then officer frontend. Rollback: remove the React route; API can remain.

## Open Questions

None that block apply. Handle is **`/x-hard-data/hw/{NORMALIZED_SERIAL}`** on **https://serpico.onrender.com**.
