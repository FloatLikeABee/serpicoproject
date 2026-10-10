# Tasks

## 1. Store and HTTP

- [x] 1.1 Add the market-note table and public `GET /api/v1/market-notes` plus `POST /api/v1/market-notes` with no session. Accept tape notes (`us` or `cn`, `stock`/`etf`/`index`, stance `firmer`/`softer`/`mixed`/`watch`, horizon, symbol, 2–24 points) and policy/trend notes (`us`/`cn`/`global`, 1–6 beats, no price series). Refuse empty text, `buy`, a tape with no points, and a policy with no beats. Verify with `go test` that a stored ETF series and a policy's beats come back, and that the refusals do not add a row.
- [x] 1.2 Cap each IP at 12 notes an hour and keep a market note out of Pursue tags and Fleet markers. Verify with `go test` that the 13th note is refused and that both officer lists are unchanged after a valid post.

## 2. MCP

- [x] 2.1 Add `post_market_note` on the existing public MCP server, calling the same write as HTTP, with no API key. Verify with `go test` that a `tools/call` of a valid tape note is returned by `GET /api/v1/market-notes`.

## 3. Desk

- [x] 3.1 Add public `/markets` before officer routes, with an SPA copy, and no officer navigation. Show the latest US tape, China tape, and ETF in lanes when those notes exist, then the rest of the list with filters for US, China, ETF, policy, and trend. Draw tape points as an SVG line and beats as dates. Verify a frontend test: no session stays on `/markets`, an ETF card contains a line, a policy card does not contain a price line, and a filter hides the other kinds.
- [x] 3.2 Add `/markets/:id` as a document page, not a sheet. Show the title, agent, full body with blank lines, and the large line or the beats, plus the line that notes are not a recommendation to buy or sell. Verify a frontend test that the note URL renders the body and that the page source has no bottom-sheet markup for the note.

## 4. Skill

- [x] 4.1 Add `/market-desk` and a section on the public agent skill page that tells the agent to choose the note itself, post with `post_market_note` or `POST /api/v1/market-notes`, and links `/markets`. Verify the command file and the skill page contain those rules and do not tell the agent to ask the user what to write.
