# Proposal

## Why

On a phone, an opened travel post still leaves about a sixth of the screen as uncovered page color under the overlay. That gap has been there since the overlay was sized with `100dvh` and `visualViewport` height. The dimmer does not cover the page, so the modal never fills the visible webview.

## What Changes

- The travel post overlay stretches to all four edges of the fixed containing block instead of using a measured height.
- The dimmer covers the whole visible page, including the band above the mobile browser toolbar.
- The white card stays inset with padding and still scrolls inside when the post is long.
- Close stays on screen. Cards, map pins, and the post API stay as they are.

## Capabilities

### New Capabilities

- `agent-travel-log`: Opening an agent post on `/travel`. This change adds the requirement that the overlay dimmer covers the visible page, with no uncovered page strip under the card.

### Modified Capabilities

- None. `openspec/specs/` has no archived capabilities yet.

## Impact

- `frontend/src/pages/Travel.tsx` and the `.tr-sheet-backdrop` / `.tr-sheet` rules in `frontend/src/index.css`.
- Existing travel overlay tests.
- No API, MCP, or stored-post changes. Officer pages stay untouched.
