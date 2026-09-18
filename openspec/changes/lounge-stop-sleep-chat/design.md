# Design

## Context

See proposal.md — Why. `/shuileme` is live with five docks, geometric JPEGs, generated Web Audio that often stays silent, and no chat. `/lalem` already has funny `POST /api/v1/lalem/chat` with `chatBusy` but no thinking row, and an 已坐 clock with no end control. Isolation: `html.sm-world` / `.sm-*` vs `html.ll-world` / `.ll-*`. Wiki allowlist and SiliconFlow `CompleteFn` already exist. Luxury gold PR #104 stays out.

## Goals / Non-Goals

**Goals:**

- Header session-stop on both lounges (stay on page).
- Real unique Wikimedia-style JPEG pack for 睡了么 beds + bedrooms; sequential gallery reveal.
- Gesture-safe audible sound with playing + 停.
- Sixth 睡了么 dock: dry lecture chat + canned fallback.
- Thinking status on both chats (fun vs sleepy).

**Non-Goals:**

- Restyling officer chrome, Fridge Raid, or 拉了么 tokens beyond additive 完了 + thinking.
- Changing 拉了么 funny poop voice, 拉榜 increment, companion 90s/8min cadence (except 完了 turns those loops off).
- Archiving `shuileme-sleep-lounge`, merging #104, Notification API, `<video>`, remote media CDNs, Wikipedia `<a>`.
- Clinical sleep advice, CBT-I, accounts, SQLite chat history, a third Render service.
- Replacing lore illustrations (beds/rooms only).

## Decisions

### 1. Header stop, not a dock and not a navigate-away

**Choice:** One header button beside the language toggle.

- 拉了么: i18n 完了 / Done sitting. Set `sessionOver=true`. Freeze the displayed 已坐 by snapshotting elapsed and skipping the interval increment. `setSitAlert(0)`, `setCompanion(null)`, skip sit-alert and companion effects while `sessionOver`. Do not clear catalogs, dock, or chat.
- 睡了么: i18n 醒了 / I'm up. Same freeze for 已躺. Call `stopShuilemeSound()` and clear the playing scene. Chat remains usable (they are awake).

**Rejected — close the tab / `history.back()`:** Leaves them on a bright officer page.

**Rejected — stop is only 声 停:** User asked for over/wake on both apps, not just audio.

### 2. Sequential gallery: paint cards now, assign `src` in a queue

Empty-grid flash is catalog-wait **plus** every JPEG competing at once. Fix both:

1. When beds/rooms JSON arrives, render **all** visible card shells immediately (title, meta, 1:1 reserved box `.sm-ph`). Do not wait for image bytes.
2. Prime at most the first **two** visible imgs with `src`, `fetchpriority="high"`, `loading="eager"`.
3. Remaining cards keep `data-src` (no `src`) until the previous image fires `load` or `error`, then set `src` with `loading="lazy"`.
4. Never `Promise.all` the pack before painting.
5. Re-queue when filters change. Sheet heroes load independently (eager when the sheet opens).

Shared helper `queueLoungePhotos(root)` used only on `/shuileme` beds/rooms (lore MAY keep current eager-first/lazy-rest; those files are small illustrations).

**Rejected — skeleton-only until all JPEGs load:** That is the “see nothing” bug.

**Rejected — native `loading=lazy` on every card with all `src` set:** Browsers still start many connections; first paint of photos bunches. Queue is the sequential guarantee.

**Rejected — hotlink Commons:** Isolation + flaky CN. Package JPEGs under `frontend/public/shuileme/{beds,rooms}/` with `ATTRIBUTION.md` like 拉了么 toilets. Unique SHA-256, JPEG SOI, no SVG leftovers. Extend `shuileme_catalog_test.go` with the `assertLalemLocalJPEG` / unique-hash pattern.

### 3. Sound: reuse one AudioContext; resume in the gesture; show 停

Today `startShuilemeSound` calls `stopShuilemeSound()` first (`close()` + bump `generation`) then `await resume()`. Closing/recreating across an `await` drops the iOS user-activation; `void startShuilemeSound` also hides failures; gain `0.28` through a 280–800 Hz filter is easy to miss on phone speakers.

**Choice:**

- Keep one `AudioContext`. First tap: `new Ctor()` then **synchronous** `resume()` (do not `await` anything before `resume()`). Later taps: stop the **source** only, reuse `ctx`, `resume()` again if `state === "suspended"`.
- Keep the generation token so unmount cannot finish a stale start.
- Gain ~`0.45`. Honest scene labels stay.
- `playScene` is the click handler: set playing UI, then start. Export `getShuilemeSoundState(): 'idle'|'playing'`.
- Sound dock: scene `is-on`, status 正在响 / Playing, button 停 / Stop → `stopShuilemeSound`.
- Fallback: if buffer graph throws, play a tiny packaged loop at `/shuileme/sounds/{scene}.wav` via `Audio` element (still local, no CDN). Tests mock both `AudioContext` and `Audio`.
- Unmount and 醒了 still stop. Ignore `document.hidden`. No `<video>`.

**Rejected — YouTube/lofi iframe.** **Rejected — pause on hide** (phone on the nightstand).

### 4. Sleepy chat clones 拉了么 POST shape, inverts the voice

**Choice:** `AdviseShuilemeChat` + `POST /api/v1/shuileme/chat` JSON `{ locale, message, history?: [{role,text}] }` → `{ reply }`. Same SiliconFlow `CompleteFn`, trim ~600 runes, history last 6, reject `you have` / `你患有`, ≥8 canned dry lines per locale. Separate limiter `shuilemeChatHits` (8 / 10 min). Do not persist. Frontend never calls `/lalem/*`.

Prompt: slow lecturer on **law, science, math**. Short sentences. Easy words. No jokes, no `!`, no pep, no diagnosis, no “wake up”. Off-topic → one dull theorem or statute. Canned examples: commutative addition; why night is dark; a restated contract clause.

Dock `chat` (聊 / Chat). Transcript + textarea in `.sm-body`. CSS `repeat(6, minmax(0,1fr))`, 3-col wrap `<339px`. Flip the v1 “no textarea” test.

**Rejected — reuse `/lalem/chat`:** Isolation and voice clash.

**Rejected — keep v1 “no chat”:** User overrode that non-goal.

### 5. Thinking rows: same a11y, opposite mood

Both transcripts:

- While `chatBusy`, render a status **row** (not a fake assistant turn that stays). `role="status"` `aria-live="polite"`. Transcript `aria-busy={chatBusy}`.
- Drop the row in `finally` when the reply is appended.

拉了么: `.ll-think` uses existing pops `#7ee0ff` / `#c9f07a` (or current `--ll-fun-*`). Copy 正在想 / Thinking….

睡了么: `.sm-think` muted `--sm-muted`, slow ~1.8s ellipsis, no bounce. Copy 还在写…… / Still writing…. Never `#7ee0ff` / `#c9f07a` / `#c6a56a`. `prefers-reduced-motion: reduce` → static text, no looping animation.

**Rejected — disable the composer without a status:** User asked not to get bored (or, on 睡了么, to stay sleepy while waiting).

### 6. Tests (TDD)

- Frontend 睡了么: six docks; 醒了 freezes timer + stops sound; sequential `src` queue; chat send shows dry reply (mock POST `/shuileme/chat`) + sleepy `role=status` while delayed; sound tap marks playing and 停 stops; no `/lalem/` fetch; no `video` / `Notification` / wikipedia `<a>` / `#c6a56a`; `Array.from` not iterator spreads.
- Frontend 拉了么: 完了 freezes 已坐 and suppresses sit-alert + companion; thinking `role=status` while delayed POST; sit-alert still stacks if 完了 was **not** tapped; `#c6a56a` absent.
- Go: unique JPEG hashes for beds/rooms; `POST /api/v1/shuileme/chat` 200 `reply`; canned when no `CompleteFn`; diagnosis stripped; limiter independent of 拉了么 chat.
- Isolation + stamp. `unset CI && npm run build`.

## Risks / Trade-offs

- **[iOS still silent]** → Resume before any await; reuse ctx; packaged wav fallback; playing UI so failure is visible.
- **[Photo pack licensing]** → Commons/PD only; ATTRIBUTION table; unique hashes fail the build if a file was duplicated.
- **[Sequential queue feels slow on Wi-Fi]** → First two eager; later lazy. Better than an empty grid.
- **[Six 睡了么 docks overflow]** → Same 6-col / 3-col wrap as 拉了么.
- **[Sleepy chat accidentally funny or clinical]** → Prompt + reject + dry canned bank; tests ban diagnosis and 拉了么 poop canned strings.
- **[完了 vs sit-alert tests]** → Existing 5-minute alert tests stay for the **unterminated** session; new tests cover post-完了 suppression.

## Migration Plan

Ship stop + photos + sound + 睡了么 chat + thinking together. Rollback: revert the two page files, sound util, CSS dock count, i18n keys, `/api/v1/shuileme/chat`, JPEG/ATTRIBUTION updates. `/lalem` chat POST unchanged. No SQLite migration. Do not archive `shuileme-sleep-lounge` in this change.

## Open Questions

None that block apply. Packaged wav fallback is optional if the reused AudioContext path is audible in the apply walkthrough; keep the files if the graph still fails on iOS.
