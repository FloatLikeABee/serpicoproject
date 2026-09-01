## Why

Partners were told to open `https://serpico-frontend.onrender.com/x-hard-data`, which is a dead hostname (plain `Not Found`). The live SPA is `https://serpico.onrender.com`. Even on the correct host, `/x-hard-data` is served as **HTTP 404** (SPA `404.html`) because Render ignores the published Netlify-style `_redirects` rewrite. That makes the hidden docs page look missing to curl, fetch, and anyone following the stale URL.

## What Changes

- Treat **https://serpico.onrender.com/x-hard-data** as the canonical unlisted page URL (still not in nav).
- Make SPA client routes (`/x-hard-data`, `/login`, and other non-file paths) return **HTTP 200** with `index.html` on the live static site, not 404.
- Document production hosts in one place: frontend `serpico.onrender.com`, backend/MQTT `serpicoproject.onrender.com`.
- On `/x-hard-data`, show copy-paste MQTT as `wss://serpicoproject.onrender.com/mqtt` (topic `serpico/hard-data/#`) and HTTP as `https://serpicoproject.onrender.com/api/v1/hard-data`.
- Update stale `serpico-frontend.onrender.com` / `serpico-backend.onrender.com` mentions in deploy docs so this does not recur.

## Capabilities

### New Capabilities

- `hard-data-page-access`: Canonical production URLs for the unlisted hard-data page; SPA paths return 200; MQTT/HTTP examples use the live backend host.

### Modified Capabilities

- None (`hard-data-ingest` is not yet archived under `openspec/specs/`).

## Impact

- Frontend static hosting: rewrite that Render actually applies (dashboard/blueprint on the live `serpico` static service — not only `frontend/public/_redirects`).
- `docs/DEPLOYMENT.md`, `openspec/config.yaml` context, and `/x-hard-data` copy (EN + 中文).
- No MQTT protocol or SQLite schema change. Backend already live at `serpicoproject.onrender.com`.
