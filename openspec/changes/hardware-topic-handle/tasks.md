## 1. Public lookup API

- [ ] 1.1 Add `GET /api/v1/hard-data/hw/:serial` that normalizes the serial, requires a `hardware_registry` row, and returns that topic’s hard data newest first; verify httptest 404 for unknown serial and 400/404 for empty/invalid serial
- [ ] 1.2 Verify MQTT-inserted rows for `serpico/hard-data/hw/SN001` appear in the SN001 response and a `serpico/hard-data/demo` (or other serial) row does not
- [ ] 1.3 Run `go test ./internal/database/ ./internal/api/ ./internal/mqttbroker/ -count=1` and confirm pass

## 2. Owner handle page

- [ ] 2.1 Add unlisted route `/x-hard-data/hw/:serial` (no officer login, before `ProtectedRoute`) that calls `GET /hard-data/hw/:serial` (not global `GET /hard-data`); verify SN001 shows topic `serpico/hard-data/hw/SN001` and the table, and `NOTREGISTERED` shows not-found without other topics
- [ ] 2.2 spa-routes copy `x-hard-data/hw` (and keep `x-hard-data`); verify officer Navigation/Login still have no `/x-hard-data/hw` link and `/x-hard-data` docs still exist
- [ ] 2.3 EN/zh copy on the handle page (match `/x-hard-data` toggle); verify both languages show the topic and table headers

## 3. Admin copy of owner URL

- [ ] 3.1 On admin hardware register/device UI, show `https://serpico.onrender.com/x-hard-data/hw/{SERIAL}` for the registered serial; verify the string uses the normalized serial

## 4. Production check (after deploy)

- [ ] 4.1 On https://serpico.onrender.com/x-hard-data/hw/{a-registered-serial} without login, confirm only that topic’s rows (including an MQTT row) appear; a bogus serial does not list other devices
