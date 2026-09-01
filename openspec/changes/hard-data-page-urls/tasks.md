## 1. Canonical URLs in docs

- [ ] 1.1 Update `docs/DEPLOYMENT.md` (and `openspec/config.yaml` production host names) so the main frontend is `https://serpico.onrender.com` and the API is `https://serpicoproject.onrender.com`; verify those files no longer present `serpico-frontend.onrender.com` or `serpico-backend.onrender.com` as working URLs
- [ ] 1.2 State the unlisted page as `https://serpico.onrender.com/x-hard-data` in deploy docs; verify the string appears and is not behind a nav mention

## 2. Hidden page MQTT/HTTP copy

- [ ] 2.1 On `/x-hard-data`, show production MQTT `wss://serpicoproject.onrender.com/mqtt` and HTTP `https://serpicoproject.onrender.com/api/v1/hard-data` plus topic `serpico/hard-data/#` in both English and 中文; verify `HardDataDocs` tests still pass and Chinese toggle still shows 硬数据接入
- [ ] 2.2 Keep local/dev examples derived from `REACT_APP_API_URL` when not on production; verify local `ws://localhost:5092/mqtt` still appears when API URL is localhost

## 3. SPA HTTP 200 rewrite

- [ ] 3.1 Apply a Render rewrite `/*` → `/index.html` on the static service that serves `serpico.onrender.com` (Dashboard and/or the blueprint that actually updates that service); do not rely on `_redirects` alone; verify `curl -sS -o /dev/null -w '%{http_code}' https://serpico.onrender.com/x-hard-data` is `200` and `/login` is `200`
- [ ] 3.2 After the 200 rewrite is confirmed, stop using `404.html` as the only SPA fallback if it still forces HTTP 404; verify GET `/x-hard-data` is HTML 200, not plain-text `Not Found`

## 4. Verification

- [ ] 4.1 Open `https://serpico.onrender.com/x-hard-data` without login; verify docs + demo, MQTT URL, and HTTP examples match `serpicoproject.onrender.com`
- [ ] 4.2 Confirm `Navigation.tsx` / Login still have no `/x-hard-data` link (grep zero hits)
