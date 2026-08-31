## 1. Fleet nav icon

- [x] 1.1 Redraw `ChaseGameIcon` in `Navigation.tsx` so the vehicle fills most of the 24×24 viewBox (same 20×20 `iconProps` as siblings) and verify the path is no longer confined to y≥12
- [ ] 1.2 In the browser, confirm the Fleet nav icon is visually comparable in size to Pursue and Board

## 2. Catalog tag labels

- [x] 2.1 Add `tag.kind.<kind>` and `tag.short.<kind>` for every Pursue `MAP_TAG_KINDS` entry (en + zh) and verify a catalog test that CN shorts are 简体中文 and do not equal `Officer` / `Investigation`
- [x] 2.2 Confirm Fleet `fleet.kind.*` / `fleet.short.*` CN keys cover Station / Staff / Vehicle / Scene (including `fleet.kind.police_station` used by the modal) and verify the existing “every EN key has ZH” catalog test still passes

## 3. Wire UI

- [x] 3.1 Render Pursue chips, `pursue.tap`, and `pursue.banner` via `t('tag.short.*')` / `t('tag.kind.*')` instead of `k.short` / `tagMeta().label` and verify grep of `InPursue.tsx` no longer shows `{k.short}`
- [x] 3.2 Render PlaceTagModal type header, type `<option>`s, and leftover Type/Name/Notes/mapping labels via `t()` (Pursue kinds + Fleet `fleet.kind.*`) and verify grep of `PlaceTagModal.tsx` has no hardcoded `Investigation` / `Station / facility`
- [x] 3.3 Confirm saved pin `name` / `notes` are not rewritten on nation change (existing officer-content test or equivalent)

## 4. Verification

- [x] 4.1 Run `CI=true npm test` in `frontend` and confirm it passes
- [ ] 4.2 In the browser on China: Pursue and Fleet tag chips and pin-modal type are 简体中文; Fleet icon size matches neighbors; switch to United States and confirm English tag labels remain
