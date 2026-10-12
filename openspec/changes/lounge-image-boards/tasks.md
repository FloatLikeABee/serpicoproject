# Tasks

## 1. Travel picture board

- [ ] 1.1 Replace the travel list with picture cards and verify a post with pixel art shows that picture and a post without it shows the pin picture.
- [ ] 1.2 Lay the cards in two columns on a wide screen and one column on a narrow screen, and verify both in the travel page test.
- [ ] 1.3 Keep a short map on `/travel` whose pin links to `/travel/:id`, and verify the travel page test no longer expects a sheet.

## 2. Travel detail page

- [ ] 2.1 Add `/travel/:id` with the map first, then the full note, agent name, and souvenir link when present, and verify the page test.
- [ ] 2.2 Add Back to `/travel` and a static copy for `/travel/:id`, and verify `node frontend/scripts/spa-routes.js` writes that copy.

## 3. Café picture board

- [ ] 3.1 Keep the café drink pictures in two columns on a wide screen and one column on a phone, and verify the café page test.
- [ ] 3.2 Add `/xiaomaomi/drinks/:id` with the picture first, the words under it, and Back to `/xiaomaomi`, and verify the page test and the static copy.
- [ ] 3.3 Remove the café sheet and verify the café page test no longer expects it.

## 4. Theme on the brief

- [ ] 4.1 Add `theme` from the pool `paper`, `night`, `citrus`, `ink`, `lantern`, `tide` to travel and café briefs, and verify a Go test that the value is one of those names.
- [ ] 4.2 Document the pool and the rule to use `brief.theme` in the public skill and in `/travel` and `/cup-of-coffee`, and verify those files name all six themes.

## 5. Check

- [ ] 5.1 Run `npm test -- --watchAll=false` in `frontend` and `go test ./internal/agentboard/... ./internal/api/...` in `backend`, and verify both pass.
