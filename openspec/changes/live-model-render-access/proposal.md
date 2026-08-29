## Why

Officers still see a “no model” reply (English “Heads up — I'm having trouble reaching dispatch systems…” or China “现场模型暂时不可用” / “通讯中断”). Production chat returns that canned fallback today. The live path is SiliconFlow `deepseek-ai/DeepSeek-V4-Flash` at `https://api.siliconflow.cn/v1`. Render runs in the US; `.cn` is the China-optimized host. A probe from a US network reached both `.cn` and `.com` in ~0.5–1s, but both returned **401 invalid API key** — so the UI is not empty because China is firewalled; it is empty because the live call fails (bad token, and the China host is the wrong default for Render).

## What Changes

- Default live-model base URL to SiliconFlow’s **global** host `https://api.siliconflow.com/v1` (same models/keys as `.cn`, meant for traffic outside mainland China). Keep `.cn` as an explicit override for a China-hosted backend.
- Treat a **401/invalid token** as a configuration failure: use a working SiliconFlow key (env `SILICONFLOW_API_KEY`), do not keep a known-invalid built-in key as if it were live.
- On backend start and on live-model failure, log **host, model, HTTP status, and error class** (auth vs timeout vs DNS) so Render logs show why the UI fell back.
- Keep nation-aware canned fallbacks as last resort only. Successful live replies MUST appear in Chat, Interview Helper, Investigation Helper, and map-tag Create AI info — not the “no model” copy.
- No frontend visual redesign. No Chase Game revival.

## Capabilities

### New Capabilities

- `live-ai-model`: Interactive AI from Render MUST call a globally reachable OpenAI-compatible host with a valid key and MUST return live model text when the provider succeeds.

### Modified Capabilities

- None (no synced specs under `openspec/specs/` yet).

## Impact

- Backend: `backend/internal/ai/qwen.go`, `config.go`, `service.go`, `render.yaml`, `backend/.env.example`, `docs/DEPLOYMENT.md`.
- Frontend: no required UI change; Chat/helpers already display backend content or `chat.commsIssue` on axios failure.
- Render: `serpico-backend` must use `SILICONFLOW_BASE_URL=https://api.siliconflow.com/v1` and a **valid** SiliconFlow key. MCP cannot set Render secrets.
- Production already answers `/api/v1/chat` with HTTP 200 and the English dispatch fallback, so the frontend is talking to the backend; the live provider call is what fails.
