# Proposal

## Why

The lounge already has an infrequent companion bubble, but visitors still cannot *talk* to the poop-science AI. Bottom sheets that slide up from a card are thin: a small photo and a blurb, or (for 拉榜) no picture at all, in a muted surface. They asked for a funny poop-only chat, then for those sheets to feel stuffed with pictures and brighter color.

## What Changes

- Add a **typed poop-science chat** on `/lalem` only (sixth dock tab, CN 聊 / EN Chat). Visitors type; the lounge replies in a **funny** poop-specialist voice (medical / biological / social / historical trivia). Not officer `/chat`, not Fridge Raid, not a replacement for the infrequent companion bubble.
- Chat is **poop-related**. Off-topic asks (officer work, Fridge Raid, news) get a funny steer back to the stall. Never a diagnosis, never “you have / 你患有”, never prescribe. Canned funny fallback when the live model is down.
- **Richer bottom sheets.** Toilet / 厕纸 / 医典 / 拉榜 detail sheets that rise from the bottom carry a large hero photo (拉榜 uses its trend JPEG), colorful chips (era, shape, kind), and fuller body copy plus credit. Palette stays lounge tokens plus extra pops (mint / coral / lilac) — **not** luxury gold `#c6a56a` / PR #104.
- Isolation unchanged: `/lalem` only. No Navigation / Fridge Raid / landing restyle. No `<video>`. No `wikipedia.org` `<a>`. Sit-alert cadence, companion 90s/8min, 拉榜 increment, and 医典 count stay as they are.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed` from existing 拉了么 changes (not archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Sixth dock is a funny poop-science chat; bottom sheets are photo-rich and more colorful; companion bubble and sit-alert overlays still win stacking as today.
- `lalem-loo-feed`: Public chat POST returns one locale-matched funny poop reply (live or canned), never diagnostic; rate-limited separately from digest and companion.

## Impact

- Frontend: `Lalem.tsx` chat dock + composer; sheet layout/CSS; i18n; dock grid 6; `lalemAbsence`; `hardDataUrls.ts` stamp. Isolated `.ll-*` / `html.ll-world`.
- Backend: `AdviseLalemChat` on SiliconFlow `CompleteFn`; `POST /api/v1/lalem/chat`; canned bank; separate limiter. No SQLite chat archive (session is in-page). No new Render service.
- Render: frontend on chat UI + sheets; backend on the new POST. No Blueprint cron.
