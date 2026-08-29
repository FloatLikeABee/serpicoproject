## 1. Global SiliconFlow host

- [ ] 1.1 Change the live-model default base URL to `https://api.siliconflow.com/v1` (keep `deepseek-ai/DeepSeek-V4-Flash`) and remap stale DashScope / `.cn` values unless `SILICONFLOW_BASE_URL` is set explicitly; verify `go test ./internal/ai/` asserts the default completions URL is `.com/v1/chat/completions`
- [ ] 1.2 Update `render.yaml`, `backend/.env.example`, and `docs/DEPLOYMENT.md` to the global host; verify those files no longer default `QWEN_BASE_URL` / `SILICONFLOW_BASE_URL` to `api.siliconflow.cn`

## 2. Auth failure vs live success

- [ ] 2.1 Stop treating the screenshot SiliconFlow key as a working live default (empty or env-only, or a key proven to return 200); verify a unit test that LoadConfig without env does not claim a known-401 key as enabled-and-valid, or documents that Enabled() requires `SILICONFLOW_API_KEY`
- [ ] 2.2 Classify SiliconFlow errors in logs (`auth` for 401, `timeout`, `network`) with host and model; verify a httptest 401 generate path logs/returns an auth-class error and ProcessChat still returns canned fallback (HTTP 200 to the client)
- [ ] 2.3 httptest a 200 chat completion and verify `ProcessChat` / `GenerateWithPrompt` return the assistant text (not the dispatch / 现场模型 fallback)

## 3. Deploy verification

- [ ] 3.1 Run `go test ./internal/ai/ -count=1` and confirm pass
- [ ] 3.2 After merge to `main`, confirm Render backend logs show Live AI model at `api.siliconflow.com` and that Chat no longer returns the canned dispatch line when a valid `SILICONFLOW_API_KEY` is set on `serpico-backend`
