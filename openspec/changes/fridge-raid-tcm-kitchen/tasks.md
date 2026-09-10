## 1. Season, weather, and card schema

- [ ] 1.1 Add Go types for fridge-raid card JSON (`season`, `solarTerm`, `weather`, `ingredientsSeen`, `askFridgeRaid`, `nudge`, `suggestions`, `disclaimer`, `locale`) and a parser that extracts JSON from raw model text (including fenced blocks); verify unit tests: clean JSON, messy fences, and prose-without-JSON returns an error (no silent essay)
- [ ] 1.2 Add season + approximate 24 solar-term lookup from a date, inverting meteorological season when latitude is negative; verify tests for a northern summer date, a southern July date (winter), and omitted lat (north default)
- [ ] 1.3 Add Open-Meteo fetch (2s timeout) mapping temp / weather_code / humidity / wind to TCM climate labels 寒/热/湿/燥/风, with a season-only fallback on error; verify tests with a fake HTTP client (hot-damp vs failure → `weatherUnavailable`)

## 2. Advisor prompt and models

- [ ] 2.1 Write the TCM culinary system prompt (four natures, five flavors, seasonal correspondence, deliciousness-first hook, 2–4 cards, ≤2-sentence hook and TCM note, no diagnosis/cure, one locale); verify a test that the assembled prompt contains those constraints and does **not** inject officer RAG/news
- [ ] 2.2 Add a fridge-raid-only SiliconFlow vision helper (multimodal `content` parts, env `FRIDGE_RAID_VISION_MODEL`) without changing `QwenClient.GenerateResponse` string content; verify a test that the request body includes an `image_url` part and that officer chat prompt building is unchanged
- [ ] 2.3 Implement pipeline: optional vision → ingredient list; then text model → card JSON using leftovers, plan, season/weather, locale; vision missing/fail with image-only → `askFridgeRaid` nudge, no invented inventory; verify fake-AI tests for leftovers→2–4 suggestions, plan+chicken/ginger→soup-like titles, image-only+vision down→ask fridge raid

## 3. Public API

- [ ] 3.1 Add `POST /api/v1/fridge-raid/chat` (locale, text, optional plan, optional image bytes, optional lat/lon) that rejects images over 1.5 MiB or non-image before vision, does not write the image to disk, and applies in-memory per-IP rate limit (~8 / 10 min → 429); verify handler tests: oversized image never calls vision, 429 after burst, successful text path returns structured suggestions
- [ ] 3.2 Wire the route in `routes.go` and optionally document `FRIDGE_RAID_VISION_MODEL` in `render.yaml` comments/env; verify the handler test hits `/api/v1/fridge-raid/chat` and existing `/chat` tests still pass

## 4. One-page app

- [ ] 4.1 Add EN + Simplified Chinese catalog keys for Fridge Raid / 翻冰箱 (title, opening fridge-raid ask, placeholders, send, photo, plan hint, disclaimer, errors, try again) using `serpico.fridgeRaid.lang` so officer nation is not overwritten; verify catalog tests for both locales
- [ ] 4.2 Implement `/fridge-raid` page: canned opening, language toggle, text + photo + plan composer, client JPEG compress, geo on first send only, sessionStorage thread, colorful seasonal cards with collapsed TCM note, no `Navigation` / synth-grid; verify RTL tests: greeting, CN toggle, fixture JSON renders ≤4 cards with expand, disclaimer visible, Navigation absent
- [ ] 4.3 Register the route in `App.tsx` outside `ProtectedRoute`; verify a source test (like `officerHardwareAbsence.test.ts`) that `App.tsx` has public `/fridge-raid` and that `Navigation`, `Login`, and `HomeGate`/landing contain no `/fridge-raid` link

## 5. Checks

- [ ] 5.1 Run the new backend fridge-raid tests and frontend fridge-raid/absence tests and verify they pass
- [ ] 5.2 Confirm officer chat, Investigation Helper disk uploads, and Chase Game are untouched (no fridge-raid primer in `BuildChatPrompt`)
