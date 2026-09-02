## 1. Header user control

- [x] 1.1 Remove the inline Account `game-panel` from the Cases scroll list and verify it is no longer in the document when Cases is rendered
- [x] 1.2 Place a compact user button immediately to the right of New case in the Cases header (same row, `aria-label` / name from `account.title`); verify New case remains and the user control is after it in DOM/order

## 2. Small account modal

- [x] 2.1 Opening the user button shows a small overlay modal with nation (US/China), logout, and display name; verify backdrop/dismiss closes it and stays on Cases
- [x] 2.2 Nation and logout in the modal call existing `setNation` / `logout` + login navigation; verify China/US buttons still present and logout still goes to `/login`

## 3. Checks

- [x] 3.1 Add or extend a frontend test for the header cluster + modal (and EN/zh `account.title` on the user button); verify `npm test` for that file passes
- [x] 3.2 Confirm Fleet / Pursue / Board / Chat were not given a new account panel (grep: Account card only via the Cases modal)
