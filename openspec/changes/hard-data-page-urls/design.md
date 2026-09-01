## Context

See `proposal.md`. Live hosts (2026-09-01): frontend `https://serpico.onrender.com`, backend `https://serpicoproject.onrender.com`. Blueprint names in `render.yaml` (`serpico-frontend`, `serpico-backend`) do not match those hostnames. `frontend/public/_redirects` already contains `/* /index.html 200` and is published, but GET `/x-hard-data` still returns **404 + SPA HTML** (`404.html` copy from the CRA build). HEAD can return plain-text 404. `serpico-frontend.onrender.com` is unused (plain 404 everywhere).

MQTT broker and `POST/GET /api/v1/hard-data` already work on `serpicoproject.onrender.com`.

## Goals / Non-Goals

**Goals:**

- HTTP 200 for SPA client routes on the live frontend.
- Docs and `/x-hard-data` copy use the hosts that actually exist.
- MQTT usage remains WebSocket-only on the backend host.

**Non-Goals:**

- Renaming Render services (risky Blueprint sync).
- TCP 1883.
- Auth on ingest.
- Putting `/x-hard-data` in Navigation.

## Decisions

### 1. Honor a rewrite Render actually applies, not `_redirects` alone

Configure a **rewrite** `/*` → `/index.html` on the **live** static service (the one serving `serpico.onrender.com`), via Render Dashboard Redirects/Rewrites and/or Blueprint `routes` if that service is the one `render.yaml` updates.

Keep `_redirects` as a no-harm extra. Stop relying on `cp build/index.html build/404.html` as the only fallback once the 200 rewrite is confirmed — `404.html` is why GET returns 404 with HTML.

- **Why:** `_redirects` is served as a static file (HTTP 200 at `/_redirects`) and does not rewrite today.
- **Alternative considered:** Remove `404.html` only. Rejected unless rewrite is live first (would regress to plain `Not Found`).
- **Alternative considered:** Change `render.yaml` `name: serpico-frontend` to `serpico`. Rejected as default; Blueprint rename can create a second site. Document the live name vs blueprint name instead.

### 2. Canonical URLs in docs and on the hidden page

`docs/DEPLOYMENT.md` and `openspec/config.yaml` context: frontend `https://serpico.onrender.com`, backend `https://serpicoproject.onrender.com`.

On `HardDataDocs`, production examples (when the API host is `serpicoproject.onrender.com` or the page is served from `serpico.onrender.com`) show those MQTT/HTTP URLs explicitly, EN + 中文.

### 3. Do not add a nav link

Still unlisted. Fix reachability and documentation only.

## Risks / Trade-offs

- **[Blueprint does not update the live `serpico` service]** → Mitigation: Dashboard rewrite on that service; verify with `curl -o /dev/null -w '%{http_code}' https://serpico.onrender.com/x-hard-data` expecting 200.
- **[Rewrite swallows missing static files]** → Mitigation: source `/*` rewrite is already the SPA pattern; real files (`/static/js/...`) are matched first on Render.

## Migration Plan

Deploy frontend (rewrite + copy) then confirm curl 200. Rollback: revert rewrite; `404.html` still serves the SPA at 404.

## Open Questions

None that block apply. Canonical frontend is **`https://serpico.onrender.com/x-hard-data`**. MQTT is **`wss://serpicoproject.onrender.com/mqtt`**.
