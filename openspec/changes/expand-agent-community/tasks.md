# Tasks

## 1. PR 1 — Map-free travel list

- [ ] 1.1 Capture current `/travel` desktop and phone screenshots from the unchanged baseline, and verify the artifacts show the aggregate world map and current card layout
- [ ] 1.2 Add failing frontend tests that require `/travel` to omit map tiles/markers while preserving ordered post metadata, detail links, souvenir links, empty state, public access, and a single narrow-screen stream; verify the focused test fails for the existing map
- [ ] 1.3 Remove the list-page map and restyle the existing parchment post cards into a clean single-column-first editorial list without changing `/travel/:id`; verify the focused tests pass
- [ ] 1.4 Run the focused travel/public-route tests and `npm run build`, live-check `/travel` at desktop and phone widths, capture after screenshots, and verify the PR description includes both before/after views and exact command results

## 2. PR 2 — Compact remaining location pins

- [ ] 2.1 Capture the current `/travel/:id` location marker at a representative detail route, and verify the baseline artifact shows the 36px marker and any default Leaflet plate
- [ ] 2.2 Add failing tests for a no-larger-than-24px marker, 12px coordinate anchor, transparent borderless Leaflet host, preserved icon variants, and unknown-icon fallback; verify they fail against the current marker
- [ ] 2.3 Implement the compact marker factory and cohesive travel-theme face styles without changing stored icon names; verify focused marker and detail tests pass
- [ ] 2.4 Run the focused travel/detail tests and `npm run build`, live-check the detail map at desktop and phone widths, capture an after screenshot, and verify the PR description includes before/after marker views and exact command results

## 3. PR 3 — Knowledge model, API, MCP, and search

- [ ] 3.1 Add failing store tests for valid claimed-agent skill/experience publication, separate author credit, metadata bounds, tag normalization, 64-character ASCII skill-name derivation/fallback and YAML escaping, atomic resource/tag/prune rollback, 1,000-per-kind retention, orphan cleanup, and unknown identities; implement `agent_resources` and `agent_resource_tags` through the existing idempotent table setup and verify the tests pass
- [ ] 3.2 Add failing search tests for terms across title/body/tags/agent/author/place, deduplicated repeated-kind OR with a four-kind maximum, repeated-tag AND semantics, exact agent filters, case-insensitive author/tags, knowledge-only multi-kind browsing, travel/thought inclusion when kinds are omitted, plain-text 200-character excerpts, bounded query/filter/cursor inputs, newest-first merge, opaque cursor pagination, full retrieval, and not-found; implement the normalized unified search service and verify the tests pass
- [ ] 3.3 Add failing handler tests for public publish/search/get/download routes, safe `text/markdown` attachment names, one shared six-per-hour IP limiter, every malformed or oversized filter/cursor case, and officer-store isolation; implement the four `/api/v1/agent-content` routes and verify the tests pass
- [ ] 3.4 Add failing MCP tests for advertised field schemas, preservation of every existing public-agent tool, HTTP parity of `publish_agent_content`, `search_agent_content`, and `get_agent_content`, and a seventh cross-transport publication being refused after six mixed HTTP/MCP writes; implement the three tools as adapters over the same store functions and limiter and verify the tests pass
- [ ] 3.5 Run `go test ./internal/agentboard/... ./internal/api/... -count=1` and `go test ./... -count=1`, exercise representative HTTP and MCP publish/search/get responses against a local server, and verify the backend-only PR description records API examples, test output, and that UI screenshots are not applicable

## 4. PR 4 — Community UI and agent access

- [ ] 4.1 Capture the current `/agent-skill` desktop and phone pages as the nearest existing entry surface, and verify the baseline artifacts show that no browse/search exchange exists
- [ ] 4.2 Add failing frontend tests for public `/community` and `/community/:id` routes, default repeated `skill` plus `experience` filters, debounced query/facet requests, nickname actions that filter by hidden exact agent id, result cards, pagination, loading/empty/failure/retry/not-found states, complete Markdown detail with raw HTML disabled, skill-only copy/download actions, clipboard success announcement, and absence of officer chrome; verify they fail before implementation
- [ ] 4.3 Implement the community browse and document-detail pages, shared content API/types, public routes, SPA copies, responsive styles, explicit non-success states, and a link from `/agent-skill`; verify focused component and public-route tests pass, including preservation of loaded cards after pagination failure and keyboard traversal through any deferred cards
- [ ] 4.4 Add a publishing/search/retrieval workflow to `.cursor/commands/` and update `frontend/public/agent-skill/SKILL.md` with identity, fields, limits, HTTP fallback, MCP tools, and retention; add source tests first and verify the command and public skill remain in sync
- [ ] 4.5 Run the focused community/agent-skill/public-route tests and `npm run build`, live-check browse, search, skill detail, copy, download, and experience detail at desktop and phone widths, capture after screenshots, and verify the PR description includes before/after views and exact command results

## 5. Cross-PR integration

- [ ] 5.1 On the final stacked state, run `go test ./... -count=1`, `CI=true npm test -- --watchAll=false`, and `npm run build`; verify there are zero failures and no officer navigation, Fleet/Pursue storage, admin-frontend, Render/hosting/environment, or other deployment-configuration changes in the diff
- [ ] 5.2 Request code review for each PR against its declared OpenSpec requirements, fix all critical and important findings with fresh tests, push each branch, and verify every PR remains unmerged for PO review

## Workflow follow-up

- After all implementation PRs are approved and merged, sync/archive this OpenSpec change without archiving unrelated active changes.
