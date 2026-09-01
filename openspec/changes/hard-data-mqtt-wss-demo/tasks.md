## 1. Client and copy

- [x] 1.1 Add the `mqtt` package to the frontend and verify `frontend/package.json` lists it (used only by the unlisted hard-data page)
- [x] 1.2 Add EN and 中文 catalog keys for the MQTT demo send control and connect/publish failure (keep `hardData.send` as HTTP POST sample); verify `catalog.ts` has both languages and existing `catalog.test.ts` still passes

## 2. Live MQTT WSS demo

- [x] 2.1 Add a Publish MQTT control on `/x-hard-data` that uses the same topic/payload fields, connects to this environment’s `/mqtt` WebSocket (`mqttWsUrl` / production `wss://serpicoproject.onrender.com/mqtt`), and publishes UTF-8 payload; verify the HTTP POST sample button remains
- [x] 2.2 After a successful MQTT publish, poll `GET /api/v1/hard-data` until a matching `source=mqtt` row appears (or timeout with an error); verify the list shows topic, payload, and source `mqtt` and does not claim stored on connect/publish failure
- [x] 2.3 On localhost API, verify the MQTT demo targets `ws://localhost:<port>/mqtt` (not a hardcoded production host)

## 3. Tests and unlisted page

- [x] 3.1 Extend `HardDataDocs.test.tsx`: mock `mqtt.connect`/`publish`, assert both POST sample and MQTT publish controls, 中文 MQTT label plus 硬数据接入, and a mocked publish then GET that lists `source: mqtt`; verify `npm test -- --watchAll=false HardDataDocs.test.tsx catalog.test.ts` passes
- [x] 3.2 Confirm Navigation / Login still have no `/x-hard-data` link (grep zero hits)

## 4. Production check (after deploy)

- [ ] 4.1 On https://serpico.onrender.com/x-hard-data without login, use Publish MQTT against `wss://serpicoproject.onrender.com/mqtt` and verify a new list row with source `mqtt`
