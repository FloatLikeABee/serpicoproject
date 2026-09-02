## Context

See `proposal.md`. Account nation/logout exist only as an inline `game-panel` at the bottom of `Notes.tsx` (Cases). The header already has New case (`cases.new`) on the right. Screenshot: the Account card sits under notes and looks disconnected from the desk chrome.

## Goals / Non-Goals

**Goals:**

- Header cluster: `[New case][User]` on the right.
- Small overlay modal with existing account fields.
- Same `setNation` / `logout` as today.

**Non-Goals:**

- Account entry on Fleet / Pursue / Board / Chat.
- Changing nation persistence or i18n rules.
- A new settings page or route.
- Redesigning New case itself.

## Decisions

### 1. User control is a compact header button, not another full-width card

Place it in the existing header `flex` row, `flex-shrink-0`, immediately after New case. Label/accessible name from `account.title` (Account / 账户). Visual: icon-style or short user chip so it does not wrap under New case on a ~390px phone.

- **Why:** User asked for a user button to the right of New case.
- **Alternative considered:** Move the whole Account panel into the header. Rejected; too wide.
- **Alternative considered:** Bottom-nav account tab. Rejected; out of scope and not requested.

### 2. Small modal, not a sheet covering the whole Cases list

Centered or anchored-under-button overlay with dim backdrop; contains nation group, logout, display name. Match existing `game-panel` / neon border so it fits the police theme. Escape and backdrop click close.

- **Why:** “Small modal” is explicit.
- **Alternative considered:** Dropdown popover only. Modal is clearer on mobile for nation + logout.

### 3. Keep account logic in AuthContext

Do not add a new nation store. Modal calls `setNation` and `logout` + `navigate('/login')` as the current panel does.

## Risks / Trade-offs

- **[Header overflow on narrow screens]** New case + user both labeled → Mitigation: compact user control (icon + `aria-label`); keep New case text as today.
- **[Discoverability]** Account no longer in the scroll → Mitigation: header is always visible; use Account as accessible name.

## Migration Plan

Frontend-only. Rollback: restore the bottom Account section.

## Open Questions

None that block apply. Cases-only; button to the right of New case; small modal.
