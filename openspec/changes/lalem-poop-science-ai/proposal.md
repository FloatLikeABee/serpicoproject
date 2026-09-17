# Proposal

## Why

拉了么 already has a sit timer, sit alerts, and a sourced 医典, but the lounge has no specialist voice. Visitors asked for an AI that lives on the loo with them: a cute, funny poop-science companion that knows medicine, biology, social custom, and history, and that pipes up from time to time — not a chat that nags every few seconds.

## What Changes

- Add a **poop-science companion** on `/lalem` only. It is a small in-page bubble (not a typed chat, not officer `/chat`, not Fridge Raid). Copy is **funny and cute**, encyclopedia-curious, never a diagnosis, never “you have / 你患有”.
- The companion **specializes** in defecation science across four angles: **medical** (hygiene, posture, gut — not a clinic), **biological** (microbiota, reflex, Bristol-scale trivia), **social** (etiquette, public toilets, culture), and **historical** (Roman latrines, paper, palace stools). Each line is one short factoid in that voice.
- **Stimulate infrequently.** First line after a short settle (about 90 seconds of visible sit time). After that, at most **once every eight minutes**. Hidden tabs do not fire. Dismiss waits until the next slot. Sit-alert overlays stay the 5-minute gag and remain on top; the companion never stacks over them and never uses the Notification API.
- Backend: a public `GET` that asks the existing SiliconFlow live-text path for one companion line (locale-matched CN/EN), with a **canned cute fallback** when the model is down. Rate-limit the live call. Do not burn the digest increment budget.
- Isolation: `/lalem` only. No officer Navigation, Fridge Raid, or landing restyle. No `<video>`. No `wikipedia.org` `<a>`. Do not merge luxury gold PR #104. Do not change 拉榜 increment, 医典 article count, or sit-alert cadence.

## Capabilities

### New Capabilities

- None. Reuse `lalem-page` and `lalem-loo-feed` from existing 拉了么 changes (not yet archived under `openspec/specs/`).

### Modified Capabilities

- `lalem-page`: Infrequent, dismissible, cute poop-science companion bubble on `/lalem`; sit alerts still own the 5-minute overlay.
- `lalem-loo-feed`: Public companion GET returns one locale-matched line (live model or canned), specialized in poop science, never diagnostic.

## Impact

- Frontend: `Lalem.tsx` companion bubble + i18n; timer distinct from sit-alert milestones; `lalemAbsence` isolation; `hardDataUrls.ts` stamp. Isolated `.ll-*` / `html.ll-world`.
- Backend: companion prompt + parser + canned bank; Gin GET + rate limit; same `SILICONFLOW_*` text path as Fridge Raid / 拉榜 digest. No new Render service, no extra disk, no SQLite companion archive (lines are ephemeral).
- Render: frontend path filter on the bubble; backend on the new GET + prompt. No Blueprint cron.
