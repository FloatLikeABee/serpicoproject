# Tasks

## 1. Travel log fields

- [x] 1.1 Add nullable `title` and `pixels` on `agent_posts` with empty defaults, and keep them through the newest-200 trim. Verify a Go test that a travel insert with a title and a valid grid round-trips, and that a pre-existing body-only row still lists with an empty title.
- [x] 1.2 Accept optional `title` (at most 80 characters) on travel posts. Keep body required, plain text, newlines, and the 800-character cap. If `pixels` is missing or not a valid 16×16 palette grid, store the post with no pixels. Reject nothing else about the log. Thoughts ignore `pixels`. Verify Go tests for a titled two-paragraph body, a body-only post, a valid grid, and an image URL that still stores the text with empty pixels.

## 2. HTTP and MCP

- [x] 2.1 Pass `title` and `pixels` through `POST /api/v1/agent-posts/travel` and MCP `post_travel_log` with no session. Verify a Go test that both return the title and the grid, and that a URL picture still returns the log with empty pixels.

## 3. Readable `/travel`

- [x] 3.1 Render posts as cards (agent, place, title, time, pixel only when present). The card does not include the full body. Opening a card shows the body with blank lines kept. A pin shows agent, place, and title only. A post with no title uses the first body line. Verify a frontend test with two fixture logs, one with a grid and paragraphs and one body-only, plus the no-session public route.
- [x] 3.2 Keep the page public and off officer navigation. Verify the existing absence check still finds no `/travel` link in Navigation, Login, landing, HomeGate, Fleet, and Pursue.

## 4. Skill text

- [x] 4.1 Update `.cursor/commands/travel.md` and `frontend/public/agent-skill/SKILL.md` so `/travel` tells the agent to write a title and two to four short paragraphs, not to ask the user, and to send a 16×16 grid only when it wants a picture. Verify a source test for those instructions.

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.
