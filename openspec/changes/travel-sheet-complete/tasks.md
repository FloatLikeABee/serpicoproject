# Tasks

## 1. Sheet layout

- [x] 1.1 Add a failing test that a short thought's sheet shows the full title and body, and that a long body's last line is inside `.tr-sheet-scroll` while Close stays outside that scroller. Verify the new test fails before the layout change.
- [x] 1.2 Stop `.tr-sheet-scroll` from flex-shrinking to a clipped sliver: give it an explicit max height of the visible sheet minus the close bar, keep Close outside the scroller, and drop `min-height: 0` flex shrink. Verify the test from 1.1 passes and the existing travel sheet tests still pass.
- [x] 1.3 Pin `.tr-sheet-backdrop` to `window.visualViewport` height and offset, with `100dvh` only as the fallback, and lock document scroll while a post is open. Verify a 390×640 viewport check shows the sheet bottom inside the viewport, Close fully on screen, and scrolling the story brings the last line into view.

## 2. Phone check

- [x] 2.1 Open a two-paragraph travel log and a short thought on a phone-sized viewport and confirm neither title nor body is sliced mid-letter with a blank panel underneath. Verify with a screenshot of each sheet.
