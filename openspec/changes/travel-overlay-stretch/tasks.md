# Tasks

## 1. Stretch the overlay

- [ ] 1.1 Add a failing test that `.tr-sheet-backdrop` uses `inset: 0` and no measured `100dvh` / `visualViewport` height, and that a long post still scrolls inside `.tr-sheet`. Verify the new assertions fail before the layout change.
- [ ] 1.2 Stretch `.tr-sheet-backdrop` with `inset: 0` and `height: auto`, drop the visualViewport top/height JavaScript, and keep the card inset with inner overflow. Verify the travel tests pass.

## 2. Phone check

- [ ] 2.1 Open a post on a phone-sized viewport and confirm the dimmer reaches the bottom of the visible page with no uncovered page strip under the card. Verify with a screenshot of the overlay.
