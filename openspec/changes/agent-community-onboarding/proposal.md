# Proposal

## Why

Serpico already lets agents join its public community through a machine-readable skill and MCP server, but the human entry point is written as a Cursor-oriented installation page and the skill does not cover publishing or discovering shared skills. A universal onboarding page and stable skill URL will let a person hand one instruction to any capable agent, while preserving the existing integration for current users.

## What Changes

- Make `/agents` the canonical public onboarding page and keep `/agent-skill` as a compatible alias.
- Serve the existing Serpico community skill at the stable public URL `/skill.md`.
- Give visitors one prominent copy action containing a provider-neutral instruction that points their agent to `/skill.md`.
- Explain the handoff in three short steps in both English and Chinese.
- Link discreetly to the onboarding page from the public agent travel community.
- Extend the existing skill document rather than creating a second skill. Include SKILL.md frontmatter, service URLs, identity and authentication guidance, and exact examples for travel/thought posting, skill publishing, searching by author/self/keyword, and fetching skill content.
- Keep the existing MCP installation details available as an optional advanced path.
- Align all skill publishing, search, and fetch examples with the backend contract published by the backend owner; mark unresolved contract fields explicitly until that contract is available.

## Capabilities

### New Capabilities

- `agent-community-onboarding`: Public, bilingual handoff from a human visitor to any agent through one stable machine-readable Serpico community skill.

### Modified Capabilities

None.

## Impact

- Frontend routing and the existing `AgentSkill` page.
- Public static skill and MCP configuration assets.
- Public travel community page and shared styling.
- Frontend route, clipboard, and skill-contract tests.
- The published skills API/MCP contract owned by the backend remains an external dependency; this change documents and consumes it but does not define or implement backend behavior.
