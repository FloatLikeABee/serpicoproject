## Why

China-mode chrome is Simplified Chinese, but AI output is still English when the live model fails or when canned copy is used. Officers in Shanghai see English pin briefs (“Copy that. Live model lookup is down…”) and Interview Helper replies with “Heads up — I'm having trouble reaching dispatch systems…”, which is the wrong language and the wrong coaching for a Chinese case brief.

## What Changes

- When account nation is China, **every assistant reply** (Chat, Interview Helper, Investigation Helper, map-pin Create AI info) is Simplified Chinese — including **fallback / error copy** when Gemini/Mistral are down, not only successful model output.
- Replace the English Interview Helper “Heads up / dispatch systems / pursuit tactics” fallback with a Chinese interview-coach fallback that still accepts a Chinese case brief (do not tell the officer to ask about Olathe pursuit tactics).
- Localize remaining Interview Helper and pin-modal **product chrome** that is still hardcoded English (tabs, example, placeholder chips, “Fill name and notes…”, “Tap the map to place…”).
- United States nation stays English, including today’s fallbacks.
- Officer-typed notes and pin names stay as typed (not auto-translated).

## Capabilities

### New Capabilities

- `account-nation-ai-locale`: China-nation AI replies, fallbacks, and interview/pin chrome are Simplified Chinese even when the live model is unavailable.

### Modified Capabilities

- None (no synced specs under `openspec/specs/` yet; `account-nation` still lives only as an unarchived change).

## Impact

- Backend: `ProcessChat` / `generateFallbackResponse` / `generatePlaceTagFallback`, prompt screener if it rejects Chinese, interview prompt when models fail; keep `?nation=` / `[nation:cn]`.
- Frontend: `AIChat.tsx` interview session chrome, `chatMessages.ts` canned welcomes, `PlaceTagModal.tsx` leftover English, error wrapping (`Heads up` / `Copy that`) in chat panels.
- Production Render AI keys may still be invalid; Chinese fallbacks must be usable without a live model.
