## Context

See `proposal.md` for motivation. Interactive chat already goes through one OpenAI-compatible client (`QwenClient` in `backend/internal/ai/qwen.go`) with defaults `deepseek-ai/DeepSeek-V4-Flash` and `https://api.siliconflow.cn/v1`. `ProcessChat` swallows provider errors and returns `generateFallbackResponse`. Production `POST /api/v1/chat` currently returns HTTP 200 with the English dispatch fallback. A US-network probe reached both `api.siliconflow.cn` and `api.siliconflow.com` quickly; both returned 401 for the wired key. `.cn` DNS is Hong Kong ALB; `.com` is SiliconFlow’s global endpoint.

## Goals / Non-Goals

**Goals:**

- Default the live client to the global SiliconFlow host so Render (US) is not pinned to the China-optimized URL.
- Fail loudly in logs on 401 vs timeout vs DNS so “no model on the UI” is diagnosable from Render logs.
- Keep one live model for every interactive surface.

**Non-Goals:**

- Switching to Gemini/Mistral as the live model.
- Changing China/US fallback copy (already specified in `china-ai-chinese-replies`).
- Frontend restyle or Chase Game.
- Setting Render secrets via MCP (unauthorized).

## Decisions

### 1. Default base URL is `https://api.siliconflow.com/v1`, not `.cn`

Render is outside mainland China. SiliconFlow documents `.com` as the global endpoint and `.cn` as China-optimized; keys and model IDs are the same.

- **Why:** Matches the user’s hypothesis (Render + Chinese host) without abandoning SiliconFlow/DeepSeek-V4-Flash.
- **Alternative considered:** Keep `.cn`. Rejected as the production default; `.cn` stays an explicit env override.
- **Alternative considered:** Proxy through a China VM. Out of scope; `.com` is the vendor’s global path.

### 2. 401 is the primary observed failure; host switch alone is not enough

The same key returned 401 on both hosts. Apply MUST also stop treating that key as a working default: prefer `SILICONFLOW_API_KEY` from Render env; if a built-in fallback remains, it MUST be a key that actually authenticates, or live must log “not configured / invalid token” rather than pretending it is live.

- **Why:** Switching host without a valid key still yields canned UI copy.
- **Alternative considered:** Assume geo-block only. Rejected; 401 in ~1s is auth, not a China firewall drop.

### 3. Classify errors in logs; keep HTTP 200 + canned body for officers

Do not turn provider 401 into a 500 that the frontend maps to “通讯中断” unless the HTTP request itself fails. Keep today’s 200 + fallback for the officer, but log `status=401 class=auth host=… model=…` (and `class=timeout` / `class=network` similarly). Optional: one startup smoke request (short prompt, 8s timeout) that only logs pass/fail.

- **Why:** UI already has locale fallbacks; operators need the real reason in Render logs.
- **Alternative considered:** Surface raw SiliconFlow errors in the chat bubble. Rejected for officers; too leaky. Logs only.

### 4. Ignore stale DashScope / `.cn` defaults already on Render

If `QWEN_BASE_URL` is still DashScope or `.cn` from an earlier blueprint, treat those as stale the same way `qwen-plus` is already remapped — unless the operator set `SILICONFLOW_BASE_URL` explicitly.

- **Why:** Render env from `render.yaml` can outlive code defaults.
- **Alternative considered:** Document “go change the dashboard.” Insufficient; blueprint values stick.

## Risks / Trade-offs

- **[Valid key still missing after host switch]** → Mitigation: apply checklist includes setting `SILICONFLOW_API_KEY` on `serpico-backend`; tests mock 401 vs 200; startup log makes a missing/invalid key obvious.
- **[`.com` blocked in some regions]** → Mitigation: explicit `.cn` override remains.
- **[Thinking-mode empty content]** → Mitigation: keep `enable_thinking: false`; still accept `reasoning_content` if content is empty.
- **[Frontend timeout vs backend 55s]** → Mitigation: out of scope unless logs show axios `commsIssue` rather than Go fallback; chat already uses 90s.

## Migration Plan

Deploy backend with new default URL + error classification. Set a working SiliconFlow key on Render. Rollback: set `SILICONFLOW_BASE_URL` back to `.cn` (will not fix 401).

## Open Questions

None that block the spec. A working SiliconFlow key must be supplied at apply time (console at siliconflow.com / siliconflow.cn); the screenshot key is invalid on both hosts.
