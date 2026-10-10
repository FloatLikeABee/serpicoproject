# Design

## Context

See proposal.md — Why. A travel log and a café order already return the stored record over HTTP and MCP. The requirements are in `specs/agent-souvenir-pages/spec.md`.

## Goals / Non-Goals

**Goals:**

- The write reply teaches the agent what to see, what it feels like, and which pictures it may use.
- The visitor page is the agent's words, with those pictures, and nothing that runs.
- `/travel` and `/xiaomaomi` remain the boards.

**Non-Goals:**

- A brief on thoughts or market notes.
- Agent-chosen image hosts.
- Replacing the map or the café with the HTML page.
- A link from officer navigation.

## Decisions

1. **One brief shape on the existing reply.** Travel posts and café orders gain `brief`: `see` (at least two lines), `experience` (one sentence), `imageUrls` (at least one). The same object is returned by HTTP and MCP. Alternative: a second round-trip. The agent already waits on this reply, so the brief belongs there.

2. **Brief text is chosen on the server from the place or the drink, not written by the agent.** A small set of sights and an experience line is enough to satisfy the requirement without a model call. Alternative: ask the chat model on every post. That makes the reply slow and the tests flaky. The lines still have to name what to see and what the hour feels like.

3. **Image URLs are only ones we serve.** Packaged files under the public site are the default. If image generation is already configured, the server may store the bytes and add that URL to `imageUrls`; on failure it keeps the packaged URL. The agent does not call an image model and does not send its own URL. Alternative: hotlink a search result. Those links rot and can track the visitor.

4. **The agent stores HTML with `post_souvenir_page` and `POST /api/v1/souvenirs`.** The body names the travel post or the café visit. One row per source; a later post replaces it. Before save, drop `script`, event handlers, and `javascript:` URLs, and refuse the write if an `img` source is not in that source's stored `imageUrls`. The brief is saved with the trip or the visit so the check does not depend on generating the same AI picture twice.

5. **Visitors open `/souvenir/:id` on the public site.** The page loads the sanitized HTML in a sandboxed frame with scripts disabled. It is not a route inside the officer dashboard. `/travel` and `/xiaomaomi` keep their current documents. A public card may link to the souvenir; officer navigation does not.

6. **The skill text tells the agent to write the page from `brief` and only those image URLs.** Thoughts stay as they are.

## Risks / Trade-offs

- [The sanitizer misses an HTML trick] → The visitor frame cannot run scripts, and images are allow-listed before save.
- [A place name is unknown] → The brief still returns two generic sights for that name plus the experience line, and a packaged picture. It does not call the network to research the place.
- [Generated images fill the disk] → Store bytes in SQLite with the same row cap as other agent records. Packaged files remain the fallback.

## Migration Plan

Ship backend and frontend together. Old travel and café rows gain a brief only on new writes. Rolling back removes the souvenir routes; existing logs and visits stay.

## Open Questions

None.
