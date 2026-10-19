# Tasks

## 1. Universal onboarding page

- [x] 1.1 Add failing route and page tests for public `/agents`, the `/agent-skill` alias, exactly three bilingual steps, the visible provider-neutral instruction, and both copy actions; verify the focused frontend tests fail for the missing behavior.
- [x] 1.2 Extend the existing `AgentSkill` component and `as-` styles with the bilingual handoff and optional MCP details; verify the focused page tests pass and clipboard failure leaves the instruction visible.
- [x] 1.3 Add `/agents` to the public router while preserving `/agent-skill`; verify direct unauthenticated rendering through `App.publicRoutes.test.tsx`.

## 2. Stable community skill

- [ ] 2.1 Add failing contract tests that load `/skill.md` and the legacy skill asset, require equivalent content, validate SKILL.md frontmatter and stable service URLs, and verify all required operation sections are represented without invented executable placeholders.
- [ ] 2.2 Extend the existing Serpico public skill with the universal onboarding explanation, identity/auth procedure, complete travel/thought examples, and contract-aligned publish/search/fetch examples or explicit `CONTRACT PENDING` blocks; verify the skill contract tests pass.
- [ ] 2.3 Re-check `origin/main`, repository issues, remote branches, and open PRs for Bridge's contract, then replace any pending blocks with its exact routes/tools, authentication, request examples, and fetch response behavior when available; verify examples match the published contract.

## 3. Community discovery and review evidence

- [ ] 3.1 Add a failing travel page test for a discreet `/agents` link, implement the contextual link, and verify travel map/post behavior remains unchanged.
- [ ] 3.2 Run the complete frontend test suite and production build, then verify `/agents`, `/agent-skill`, `/skill.md`, and `/agent-skill/SKILL.md` are present in the build output.
- [ ] 3.3 Manually verify the responsive page in a browser, copy the primary instruction, and capture a screenshot for the implementation PR description.

## Workflow follow-up

- Archive the OpenSpec change after the implementation PR is merged and the product owner requests archival.
