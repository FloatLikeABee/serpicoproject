# Design

## Context

See proposal.md — Why. `/lalem` already has a sit-session timer, 5-minute sit-alert overlays (`ll-sit-alert`, z-index above the wiki reader), and 拉榜 digest via SiliconFlow `CompleteFn` with canned fallback. 医典 is a static sourced catalog (not a chatbot). Isolation `.ll-*` / `html.ll-world`. Unmerged luxury gold PR #104 stays out. Digest GET is a SQLite keep-and-append plus rate-limited increment — do not hitch companion chatter onto that increment.

## Goals / Non-Goals

**Goals:**

- One dismissible companion bubble on `/lalem`, first at ~90s visible sit time, then ≥8 minutes apart.
- Live-text specialist prompt (medical / biological / social / historical) plus canned cute fallbacks.
- Sit alerts unchanged; companion never uses Notification API.

**Non-Goals:**

- Typed chat, conversation history, or officer `/chat` reuse.
- SQLite archive of companion lines, daily 医典 generator, or 拉榜 increment changes.
- OS notifications, `<video>`, Wikipedia `<a>`, Fridge Raid, Navigation, #104.

## Decisions

### 1. Proactive bubble, not a chat composer

Visitor asked to be “stimulated from time to time,” not to interview a model. Render a compact `.ll-companion` bubble (copy + dismiss). No textarea. Optional later: tap opens 医典 — **out of scope** this change.

**Alternative:** Full chat dock. Rejected: too frequent, too much chrome, collides with 医典.

### 2. Timer is sit-session visible time, offset from sit alerts

Reuse the existing sit clock (`Date.now()` minus mount). Count only while `document` is visible (same idea as sit alerts). First fire at **90 seconds**; interval **480 seconds** thereafter. Sit alerts stay at 5/10/15… minutes. If both would show, sit alert wins (blocking); companion waits until the alert is dismissed or the next slot.

**Alternative:** Fire on every sit-alert dismiss. Rejected: that is still every 5 minutes — too frequent.

### 3. Dedicated GET, same SiliconFlow path

`GET /api/v1/lalem/companion?locale=` returns `{ text, angle }` (`angle` one of `medical|biological|social|historical`). New `AdviseLalemCompanion` using existing `CompleteFn`. Prompt: cute/funny, one or two short sentences, one angle, no diagnosis, no “you have / 你患有”, no URLs. Parse JSON or a single line. Canned bank ≥8 lines per locale covering all four angles. Rate-limit live calls (e.g. one live generation per IP per few minutes); extra GETs get canned. Do not persist.

**Alternative:** Fold into digest. Rejected: digest is a store read / daily increment, not a sit-time gag.

### 4. Tests (TDD)

- Frontend: fake timers — no bubble before 90s; bubble at 90s with cute copy; dismiss; no second bubble before +8 min; hidden tab does not show; sit-alert z-index still higher; `querySelector('video')` null; no `wikipedia.org` `<a>`; `Array.from` not iterator spreads.
- Go: companion GET 200 with text; locale; canned when `CompleteFn` nil/error; reject diagnostic strings.
- Isolation + `hardDataUrls.ts` stamp. `unset CI && npm run build` (no TS2802).

## Risks / Trade-offs

- **[Live model writes crude or diagnostic copy]** → Prompt + reject/replace if body matches diagnose patterns; fall back to canned.
- **[Too chatty / too quiet]** → Hard 90s / 8 min in spec; do not randomize below that floor.
- **[Collides with sit alert]** → Sit alert remains the only blocking overlay; companion is non-modal bubble.
- **[Digest rate-limit shared accidentally]** → Separate limiter key for companion GET.

## Migration Plan

Ship frontend bubble + companion GET together. Rollback: revert route and bubble; digest and sit alerts unchanged. No SQLite migration.

## Open Questions

None that block apply. Companion is not a daily generator.
