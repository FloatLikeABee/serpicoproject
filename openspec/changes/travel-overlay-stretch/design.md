# Design

## Context

See proposal.md — Why. `/travel` opens a post in `.tr-sheet` over `.tr-sheet-backdrop` (`frontend/src/pages/Travel.tsx`, `frontend/src/index.css`). The backdrop is `position: fixed` with `top/left/right: 0` and `height: 100dvh`, then JavaScript overwrites `top` and `height` from `window.visualViewport`. On Chrome iOS those numbers are not the same rectangle as the fixed containing block, so the dimmer stops short and the travel page color shows under the card.

## Goals / Non-Goals

**Goals:**

- Stretch the dimmer to all four edges of the fixed containing block.
- Keep the white card inset and internally scrollable.
- Remove the measured-height path that created the gap.

**Non-Goals:**

- Changing card layout, map pins, pixel data, or the post API.
- Changing other lounge sheets.

## Decisions

1. **Stretch the backdrop with `inset: 0` and `height: auto`.** Do not set `100dvh` or `visualViewport.height`. Alternative: keep measuring `visualViewport` and add a fudge. That is what is live now, and the phone still shows the uncovered strip.

2. **Drop the visualViewport top/height JavaScript.** Keep document overflow locked while a post is open. Alternative: keep the listeners and also set `bottom: 0`. Mixing measured height with edge pinning is the bug.

3. **Keep the card at `height: 100%` of the padded backdrop, `min-height: 0`, `overflow: auto`, sticky Close.** Long posts still scroll inside. Short posts still fill the overlay as a large covering modal.

## Risks / Trade-offs

- [The dimmer extends under the browser toolbar] → That region is already covered by chrome. Padding keeps the card in the visible gutter.
- [A browser with no visual-viewport-relative fixed positioning] → `inset: 0` still covers the layout viewport, which is larger than the gap we have now, not smaller.

## Migration Plan

Ship as a frontend-only change on `/travel`. Rolling back restores the previous backdrop CSS and the visualViewport fit. No stored data moves.

## Open Questions

None.
