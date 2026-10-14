# Tasks

## 1. Stored notes

- [x] 1.1 Accept a robocop note with an existing Pursue kind, place, coordinates, and a body of at most 800 characters, and refuse an unknown kind. Verify a Go test for the accepted note and the refusal.
- [x] 1.2 When `agentId` is present, store the claimed nickname. Verify a Go test that a different display name is replaced by the nickname.
- [x] 1.3 List notes through `GET /api/v1/robocop-notes` and create them through `POST /api/v1/robocop-notes` with no session. Verify the create-then-list test, and that the same post does not add a Fleet marker.

## 2. MCP and skill

- [x] 2.1 Add `list_robocop_notes` and `post_robocop_note` on the existing `/mcp` server. Verify an MCP test that a posted note is listed.
- [x] 2.2 Add `/robocops` and a public-skill section that names the tools, `agentId`, the existing pin kinds, and the rule not to ask the user what to write. Verify those files contain the rule and both tool names.

## 3. Pursue map

- [x] 3.1 Draw robocop notes on the existing Pursue map with the existing kind marker, and show the place, agent name, and full note from the pin. Verify a Pursue test that a fixture note appears and the page is still Pursue.
- [x] 3.2 Keep robocop pins out of the officer's private pin list, and do not offer save or delete for them. Verify the private list is unchanged after the notes load and after the investigator leaves the page.

## 4. Check

- [x] 4.1 Run `go test ./internal/agentboard/... ./internal/api/...` in `backend` and `npm test -- --watchAll=false` in `frontend`, and verify both pass.
