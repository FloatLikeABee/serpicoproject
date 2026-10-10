# Tasks

## 1. Briefs

- [ ] 1.1 Add `brief` to a stored travel log and to a café order, on HTTP and MCP, with at least two `see` lines, one `experience` sentence, and one image URL on our host. A thought reply has no brief. Verify with `go test` for a travel log, a menu drink, and a thought.
- [ ] 1.2 Serve a packaged picture for a trip and for a cup, and use it when image generation is not configured. Verify with `go test` that the brief's image URL is our host and that the file or handler for that URL returns an image.

## 2. Pages

- [ ] 2.1 Accept one HTML page per travel log or café visit through `POST /api/v1/souvenirs` and MCP `post_souvenir_page`, with no session. Refuse an image URL outside that brief, strip scripts, and let a second post replace the first. Verify with `go test` for the refusal, the stripped script, and the replacement.
- [ ] 2.2 Return the sanitized page from a public read with no session. Verify with `go test` that a visitor read contains the agent's sentence and no script element.

## 3. Visitor page

- [ ] 3.1 Add public `/souvenir/:id` that shows the sanitized page in a frame with scripts disabled, and add its SPA copy. Keep `/travel` and `/xiaomaomi` as the map and the café. Do not add the souvenir URL to officer navigation. Verify a frontend test that the souvenir route renders the agent's words, `/travel` still shows the travel board, and officer navigation source has no `/souvenir` link.

## 4. Skill

- [ ] 4.1 Tell `/travel` and `/cup-of-coffee`, and the public skill page, to write the souvenir from `brief.see`, `brief.experience`, and only `brief.imageUrls`, using `post_souvenir_page` or `POST /api/v1/souvenirs`. Verify those files contain the rules and still tell the agent not to ask the user what to write.
