## 1. Detail payload and prompt

- [x] 1.1 Add Go types + parser for dish-detail JSON (`title`, `steps`, `tasteNote`, `tcm.nature/flavors/goodFor/caution`, `disclaimer`, `locale`) with the same string-or-array coercion as fridge-raid cards; verify unit tests: clean JSON, fenced JSON, string `steps`/`goodFor`, prose-without-JSON errors
- [x] 1.2 Add `BuildFridgeRaidDetailPrompt` that takes the suggestion card + locale + season/weather, asks for JSON only, ranks cook steps then culinary TCM “good for”, and bans diagnose/prescribe/cure; verify a prompt test for needles (steps, 寒/热 or natures, 开胃/good for, disclaimer) and that officer `BuildChatPrompt` still has no fridge-raid primer

## 2. Detail API

- [x] 2.1 Add `AdviseFridgeRaidDetail` on the advisor/service using the existing live SiliconFlow client (no vision, no image field); verify a test that a stubbed complete returns parsed steps + goodFor and that a missing live model does not call vision
- [x] 2.2 Add `POST /api/v1/fridge-raid/detail` (locale + suggestion + optional season/weather), share the fridge-raid chat rate-limit bucket, reject if title is empty; verify handler tests: 200 fixture JSON, 429 after burst, officer `/chat` tests still pass

## 3. Kitchen modal UI

- [x] 3.1 Add i18n keys for modal close, busy, error, try again, steps heading, TCM heading, good-for heading, caution heading (en + zh) under `fridgeRaid.detail.*`; verify catalog tests
- [ ] 3.2 Implement the kitchen `role="dialog"` overlay (mobile sheet / desktop centered, opaque, ESC/backdrop/close, body scroll lock, isolated `.fr-modal*` CSS, no Navigation/synth-grid); verify RTL: open shows dialog named by dish title, close/Escape/backdrop dismiss, no `navigation`
- [ ] 3.3 Wire card click to open the modal (TCM expand `stopPropagation`), fetch `/fridge-raid/detail` on first open, session-cache by locale+title+uses, show busy then steps + culinary TCM + disclaimer; verify: click card opens dialog with fixture steps, TCM peek does not open dialog, second open does not call fetch again

## 4. Isolation and verify

- [ ] 4.1 Confirm officer Navigation, Login, landing/HomeGate still have no `/fridge-raid` and no detail-modal copy; verify existing `fridgeRaidAbsence` test still passes
- [ ] 4.2 Run fridge-raid frontend tests plus `go test ./internal/ai ./internal/api -count=1` and verify they pass
