# Design

## Context

See proposal.md — Why. `/travel` opens a post in `.tr-sheet` (`frontend/src/pages/Travel.tsx`, `frontend/src/index.css`). The sheet is a column flex box with `max-height: calc(100dvh - 0.75rem)` and `overflow: hidden`. The story sits in `.tr-sheet-scroll` with `flex: 1 1 auto`, `min-height: 0`, and `overflow: auto`. On a phone that combination collapses the story region: a line is sliced through the middle, and the rest of the sheet is an empty cream panel. The backdrop height is `100dvh`, which still includes area under the mobile browser toolbar.

## Goals / Non-Goals

**Goals:**

- The opened sheet's story region has a real height: either the whole post, or the space left in the visible screen.
- Close stays outside that scroller.
- The sheet's box is the visual viewport, not the taller layout viewport.

**Non-Goals:**

- Changing card layout, map pins, pixel data, or the post API.
- Changing the café visitor modal.

## Decisions

1. **Cap the story with an explicit max height, and stop flex-shrinking it to nothing.** The close bar stays `flex: 0 0 auto`. The story region gets `max-height` of the visible sheet minus that bar, `overflow: auto`, and no `min-height: 0` flex shrink inside an indefinite column. A short thought then shows its full title and body. A long log scrolls to the last line. Alternative: keep `flex: 1; min-height: 0` and only switch units to `svh`. That is what is live now, and the phone screenshots still show a sliced line over a blank panel.

2. **Pin the backdrop to `window.visualViewport`.** Set the backdrop's top and height from `visualViewport.offsetTop` and `visualViewport.height`, and update those on `resize` and `scroll`. Use `100dvh` only as the stylesheet fallback before that runs. Alternative: `100svh` alone. It does not track the toolbar as it shows and hides, which is the gap in the current sheet.

3. **Leave line clamping on the cards.** The sheet title and body stay unclamped, with paragraph breaks preserved. The picture stays in the scrolling story, under the title.

## Risks / Trade-offs

- [A browser with no `visualViewport`] → The `100dvh` fallback still caps the sheet; the explicit story `max-height` prevents the collapsed blank panel.
- [The page behind the sheet still moves] → Lock document scrolling while a post is open, and keep `overscroll-behavior: contain` on the story scroller.

## Migration Plan

Ship as a frontend-only change on `/travel`. Rolling back restores the previous sheet CSS. No stored data moves.

## Open Questions

None.
