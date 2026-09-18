# Proposal

## Why

睡了么 shipped as a dim bedtime lounge, but visitors cannot end a sit/lie session, beds and bedrooms still look like geometric stills, sound often plays nothing after a tap, and there is no sleepy chat. 拉了么 already has funny chat, but neither lounge shows that the model is busy, so waiting feels like a dead page.

## What Changes

- Add an in-page **session stop** on both lounges: 拉了么 **完了 / Done sitting** (freeze 已坐, dismiss sit-alert + companion, stay on `/lalem`); 睡了么 **醒了 / I'm up** (stop Web Audio, freeze 已躺, stay on `/shuileme`). Neither stop navigates away or hits officer chrome.
- Replace 睡了么 **beds and bedrooms** with a locally packaged **real photograph** pack (Wikimedia Commons / public-domain JPEGs, same pattern as 拉了么 toilets). Lore MAY keep illustrated stills. Galleries MUST paint cards as soon as catalog JSON arrives and reveal photos **one after another** (eager first 1–2, then lazy sequential `onload`) so visitors never stare at an empty grid while bytes load.
- Fix 睡了么 **sound**: unlock `AudioContext` in the same tap, keep a playing state + **停**, audible gain, stop on 醒了 and on unmount. Optional tiny local `/shuileme/sounds/` loops if the generated graph fails. Still no CDN, `<video>`, or YouTube.
- Add a sixth 睡了么 dock **聊**: typed AI chat that lectures **boring law / science / math** in short easy sentences so visitors can fall asleep. Dedicated `POST /api/v1/shuileme/chat` (never `/lalem/*`). Canned dry fallback. Never diagnose.
- Both chats get a **thinking indicator** while the model is busy (`aria-busy` / `role=status`). 拉了么 stays colorful/fun. 睡了么 is muted, slow, and boring; `prefers-reduced-motion` is static.

## Capabilities

### New Capabilities

- None. Reuse `shuileme-page`, `shuileme-sleep-feed`, and `lalem-page` from existing lounge changes (not archived under `openspec/specs/`).

### Modified Capabilities

- `shuileme-page`: Header 醒了 stop; sixth dock 聊 with boring lecture chat and sleepy thinking indicator; sequential real-photo beds/bedrooms gallery; sound dock shows playing + 停 and actually audibly plays.
- `shuileme-sleep-feed`: Beds/bedrooms catalogs point at unique local photograph JPEGs (SOI + unique hashes, no hotlinks); public `POST /api/v1/shuileme/chat` returns one locale-matched dry lecture reply (live or canned), never diagnostic.
- `lalem-page`: Header 完了 stop for the sit session; chat transcript shows a colorful thinking indicator while `POST /lalem/chat` is in flight. Sit-alert cadence, companion 90s/8min, funny poop voice, and 拉榜 stay as they are except that 完了 dismisses the in-flight sit loops.

## Impact

- Frontend: `Lalem.tsx` stop + thinking row; `Shuileme.tsx` stop, sixth dock, sequential gallery, sound playing/stop; `shuilemeSound.ts` gesture-safe start; i18n; dock CSS `repeat(6, …)` wrap `<339px`; Wikimedia-style JPEGs under `frontend/public/shuileme/{beds,rooms}/` + ATTRIBUTION; optional `/shuileme/sounds/`; isolation tests; `hardDataUrls.ts` stamp.
- Backend: `AdviseShuilemeChat` on SiliconFlow `CompleteFn`; `POST /api/v1/shuileme/chat`; canned dry bank; separate limiter. Catalog JSON `imageUrl` + credit updates. No SQLite chat archive. No new Render service.
- Isolation unchanged: `.sm-*` / `html.sm-world` vs `.ll-*` / `html.ll-world`. No officer Navigation, Fridge Raid, landing restyle. No `#c6a56a` / `#ff4d8d`. Do not merge luxury gold PR #104. Do not archive `shuileme-sleep-lounge`.
