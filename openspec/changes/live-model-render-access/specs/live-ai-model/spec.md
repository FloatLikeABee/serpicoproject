## Purpose

Makes the interactive live model reachable from Render so Chat, interviews, helpers, and map-tag briefs return real model text instead of canned “no model” copy.

## ADDED Requirements

### Requirement: Live model uses a globally reachable SiliconFlow host

The backend SHALL call SiliconFlow’s OpenAI-compatible chat completions API at `https://api.siliconflow.com/v1` by default (model `deepseek-ai/DeepSeek-V4-Flash` unless overridden). A China-optimized host (`https://api.siliconflow.cn/v1`) MAY be used only when explicitly configured. Chat, Interview Helper, Investigation Helper, and map-tag Create AI info SHALL use this same live model.

#### Scenario: Default host is global

- **WHEN** `SILICONFLOW_BASE_URL` / `QWEN_BASE_URL` is unset or set to the previous DashScope / `.cn` default
- **THEN** live completions are sent to `https://api.siliconflow.com/v1/chat/completions` with model `deepseek-ai/DeepSeek-V4-Flash`

#### Scenario: China host is opt-in

- **WHEN** `SILICONFLOW_BASE_URL` is set to `https://api.siliconflow.cn/v1`
- **THEN** live completions use that China host instead of `.com`

#### Scenario: All interactive surfaces share one live model

- **WHEN** an officer sends Chat, Interview Helper, Investigation Helper, or map-tag Create AI info
- **THEN** the backend uses the same live SiliconFlow model (not Gemini or Mistral as a live hop)

### Requirement: Valid key is required; invalid token is not treated as a working model

The backend SHALL authenticate with `SILICONFLOW_API_KEY` (aliases `QWEN_API_KEY` / `DASHSCOPE_API_KEY`). A 401 / “Api key is invalid” / “Token is invalid” response SHALL be logged as auth failure. The system MUST NOT present a known-invalid built-in key as a successful live configuration.

#### Scenario: Invalid key logs auth failure

- **WHEN** SiliconFlow returns HTTP 401 for the configured key
- **THEN** Render logs include host, model, and an auth-failure class (not only a generic generate error)

#### Scenario: Valid key returns live text

- **WHEN** SiliconFlow accepts the key and returns assistant content
- **THEN** Chat (and the other interactive surfaces) show that content and MUST NOT show the canned “Heads up — I'm having trouble reaching dispatch systems…” or “现场模型暂时不可用” fallback

### Requirement: Canned fallbacks remain last resort only

When the live provider is unreachable, times out, or returns a non-success response, the backend MAY return the existing nation-aware canned fallback. Frontend axios failures MAY still show `chat.commsIssue`. Those fallbacks MUST NOT be used when the live provider returned a non-empty assistant message.

#### Scenario: Live success is not replaced by fallback

- **WHEN** the live model returns a non-empty assistant message
- **THEN** the officer sees that message in the UI

#### Scenario: True outage still uses nation fallbacks

- **WHEN** the live call fails after retries
- **THEN** China nation still gets Simplified Chinese fallback copy and United States still gets English fallback copy (existing locale behavior)
