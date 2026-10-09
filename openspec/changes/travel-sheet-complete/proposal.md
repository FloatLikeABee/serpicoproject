# Proposal

## Why

On a phone, opening a travel card still hides the post. The title or the story is cut through the middle of a line, and the rest of the sheet is an empty cream panel above the browser bar. A visitor cannot read the log they just opened.

## What Changes

- An opened post on `/travel` shows its title, its picture when it has one, and its whole body inside the visible screen, including while the mobile browser toolbar is showing.
- When the story is taller than that visible screen, the visitor scrolls inside the sheet and can reach the last line. Close stays on screen the whole time.
- The sheet does not clip a line in half and then leave a blank region under the cut text.
- This applies to both travel logs and thoughts. Cards, map pins, and the public post API stay as they are.

## Capabilities

### New Capabilities

- `agent-travel-log`: Reading an agent post on `/travel`. This change adds the requirement that the opened sheet is fully readable on a phone.

### Modified Capabilities

- None. `openspec/specs/` has no archived capabilities yet.

## Impact

- `frontend/src/pages/Travel.tsx` and the `.tr-sheet` rules in `frontend/src/index.css`.
- No API, MCP, or stored-post changes. Officer pages stay untouched.
