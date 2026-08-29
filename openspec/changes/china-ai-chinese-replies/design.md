## Context

See `proposal.md` for motivation. Live prompts already append `[nation:cn]` / 简体中文, but `generateFallbackResponse` and `generatePlaceTagFallback` are English-only. Production often hits that path (invalid Gemini key / Mistral 403). Interview Helper chrome in `AIChat.tsx` / `chatMessages.ts` and some `PlaceTagModal.tsx` strings were not catalogued. Helper APIs stay `?userId=` plus `?nation=`.

## Goals / Non-Goals

**Goals:**

- Nation-aware fallback strings in Go (chat, interview, pin).
- Catalog remaining Interview Helper and pin helper chrome.
- Tests that CN fallbacks contain 简体中文 and do not contain the English “dispatch systems” / “Live model lookup is down” sentences.

**Non-Goals:**

- Fixing production Gemini/Mistral API keys.
- Translating officer-authored notes.
- Traditional Chinese or extra nations.
- Reviving Chase Game.

## Decisions

### 1. Localize fallbacks in Go keyed by `nationFromContext`, not only prompt text

`generateFallbackResponse` / `generatePlaceTagFallback` / screener reject copy MUST branch on `[nation:cn]`. Interview fallback is a short PEACE-style coach in Chinese, not a generic dispatch outage about pursuit tactics.

- **Why:** Production is in the fallback path; prompt language never runs if the model is down.
- **Alternative considered:** Wait for live models. Rejected; screenshots are already that failure mode.

### 2. Frontend error wrappers use `t()`

`AIChat` / `AIChatPanel` / `AIChatDrawer` “Heads up” / “Copy that — comms issue” strings go through the catalog. Interview welcome, tabs, example, chips, placeholder too.

- **Why:** Some errors never reach Go (HTTP fail before body).
- **Alternative considered:** Backend-only. Rejected; client still shows English on axios errors.

### 3. Keep `[nation:cn]` on interview/helper/pin contexts

No new headers. CORS-safe `?nation=` already exists; ensure Interview Helper chat always sends it.

## Risks / Trade-offs

- **[Live model still English if keys work but prompt ignored]** → Mitigation: keep reply-language instruction; tests on prompt + fallbacks.
- **[Screener treats Chinese as jibberish]** → Mitigation: unit-test a Chinese case brief is processed.
- **[English RAG snippets inside a Chinese fallback]** → Mitigation: CN fallback MUST NOT dump US SOP RAG as the primary reply; prefer Chinese coach/pin brief.

## Migration Plan

Frontend + backend together. Rollback: omit nation (English fallbacks).

## Open Questions

None that block the spec.
