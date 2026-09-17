# Design

## Context

See proposal.md — Why. `/lalem` already has five dock tabs, an infrequent companion GET, sit-alert overlays, and bottom sheets that are mostly a small square photo + blurb (拉榜 sheets have no photo). SiliconFlow `CompleteFn` is used for Fridge Raid, 拉榜 digest, and companion. Isolation `.ll-*` / `html.ll-world`. Unmerged luxury gold PR #104 stays out. Do not hitch chat onto digest increment or companion GET.

## Goals / Non-Goals

**Goals:**

- Sixth dock: typed funny poop-science chat with live text + canned fallback.
- Bottom sheets: large hero JPEG, colorful chips, 拉榜 photos, brighter sheet chrome without `#c6a56a`.

**Non-Goals:**

- Replacing the companion bubble, officer `/chat`, Fridge Raid, or SQLite chat history.
- OS notifications, `<video>`, Wikipedia `<a>`, Navigation, #104.
- Changing sit-alert cadence, companion 90s/8min, 医典 count, or 拉榜 increment.

## Decisions

### 1. Sixth dock tab, not a global composer

Add dock `chat` (i18n 聊 / Chat). Transcript + `<textarea>` live in `.ll-body` like 有用. Companion bubble stays unsolicited. Sit-alert z-index 40; sheets 20; companion 18; chat is page content.

**Alternative:** Tap companion to open chat. Rejected: companion is rare; visitors asked to add chat as a thing they can open.

**Alternative:** Reuse Fridge Raid composer. Rejected: isolation; kitchen voice is not poop science.

### 2. Dedicated POST, same SiliconFlow path

`POST /api/v1/lalem/chat` JSON `{ locale, message, history?: [{ role, text }] }` returns `{ reply }`. New `AdviseLalemChat` with cute/funny poop-only prompt, reject `you have` / `你患有`, parse one reply (JSON `{reply}` or a prose paragraph). Canned bank ≥8 funny lines per locale. Rate-limit live calls separately (`lalemChatHits`). Trim history to last ~6 turns. Do not persist.

**Alternative:** Fold into companion GET. Rejected: companion is timer-driven and one-shot.

### 3. Sheet chrome: hero + chips, extra pops

- Hero: `.ll-sheet-hero` full-width cover JPEG (toilet/paper/medicine `imageUrl`; trend `imageUrl` when present).
- Chips: colorful pills from existing fields (era, shape, kind) using `--ll-accent`, `--ll-pop`, plus `--ll-fun-a` `#7ee0ff` and `--ll-fun-b` `#c9f07a`. Never `#c6a56a` or `#ff4d8d`.
- Sheet background: slightly brighter `color-mix` of surface + pop, not a gold gradient.
- Keep wiki as in-lounge button; clinic `<a>` on 医典 unchanged.

### 4. Tests (TDD)

- Frontend: six dock buttons; chat send shows funny reply (mock POST); off-topic reply still poop-flavored in mock; sheets have large `img` for toilet/paper/medicine/trend; no `video`; no wikipedia `<a>`; `#c6a56a` absent; `Array.from` not iterator spreads; companion/sit-alert tests still pass.
- Go: chat POST 200 with `reply`; canned when no `CompleteFn`; diagnostic rejected; digest/companion limiters independent.
- Isolation + stamp. `unset CI && npm run build`.

## Risks / Trade-offs

- **[Chat nags or leaks clinic copy]** → Prompt + reject/replace; canned fallback; rate limit.
- **[Six dock buttons overflow]** → `repeat(6, minmax(0,1fr))`; keep 3-col wrap under 339px.
- **[Sheet color fights isolation tests]** → Extra pops only inside `html.ll-world` sheet rules; forbid `#c6a56a` / `#ff4d8d`.
- **[Companion vs composer overlap]** → Chat is a dock page; companion still hides when a sheet/wiki is open.

## Migration Plan

Ship chat POST + dock + sheet CSS together. Rollback: revert route, dock tab, sheet classes; companion and digest unchanged. No SQLite migration.

## Open Questions

None that block apply. Chat history is in-page only.
