## Why

On Cases, the Account block (nation, logout, display name) sits at the bottom of the case list as a full panel. It reads as a leftover card, not header chrome, and crowds the investigation notes on mobile.

## What Changes

- Remove the inline Account panel from the Cases scroll area.
- Put a compact **user** button immediately to the **right of New case** in the Cases header.
- Tapping that button opens a **small modal** with the same account controls: nation (United States / China), logout, and the signed-in display name.
- Nation and logout behavior stay as they are (account-bound nation, chrome language, no rewrite of officer-authored notes).
- Other modules (Fleet, Pursue, Board, Chat) do not gain this panel; they never had it.

## Capabilities

### New Capabilities

- `cases-account-modal`: Cases header user button to the right of New case; small modal for account nation, name, and logout.

### Modified Capabilities

- None (`account-nation` is not archived under `openspec/specs/`).

## Impact

- Officer frontend `Notes.tsx` (Cases) header and the bottom Account `<section>` only.
- Existing `useAuth` `setNation` / `logout` — no API or schema change.
- EN/zh labels via existing `account.*` / `cases.new` strings; add a short accessible name for the user button if needed.
