package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

const (
	defaultLiveModel   = "deepseek-ai/DeepSeek-V4-Flash"
	defaultLiveBaseURL = "https://api.siliconflow.cn/v1"
	defaultLiveAPIKey  = "sk-bdyzoncdtphfzkuobciwamljfykkooyenxknyhoulvyqpyzoq"
	qwenAttempts       = 3
)

// defaultQwenModel / defaultQwenBaseURL are aliases used by older call sites.
const (
	defaultQwenModel   = defaultLiveModel
	defaultQwenBaseURL = defaultLiveBaseURL
)

// QwenClient calls an OpenAI-compatible chat completions API (SiliconFlow).
type QwenClient struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

func NewQwenClient(apiKey, model, baseURL string) *QwenClient {
	return &QwenClient{
		apiKey:  strings.TrimSpace(apiKey),
		model:   envOrLiteral(model, defaultLiveModel),
		baseURL: envOrLiteral(baseURL, defaultLiveBaseURL),
		client: &http.Client{
			Timeout: 55 * time.Second,
		},
	}
}

func envOrLiteral(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func (q *QwenClient) Enabled() bool {
	return q != nil && q.apiKey != ""
}

func qwenCompletionsURL(base string) string {
	b := strings.TrimRight(strings.TrimSpace(base), "/")
	if strings.HasSuffix(b, "/chat/completions") {
		return b
	}
	return b + "/chat/completions"
}

type qwenChatRequest struct {
	Model          string        `json:"model"`
	Messages       []qwenMessage `json:"messages"`
	EnableThinking *bool         `json:"enable_thinking,omitempty"`
}

type qwenMessage struct {
	Role             string `json:"role"`
	Content          string `json:"content"`
	ReasoningContent string `json:"reasoning_content,omitempty"`
}

type qwenChatResponse struct {
	Choices []struct {
		Message qwenMessage `json:"message"`
	} `json:"choices"`
}

func (q *QwenClient) GenerateResponse(userMessage, context string, history []ChatHistoryMessage, ragContext []RAGDocument, webSearchResult, newsDigests string) (string, error) {
	prompt := BuildChatPrompt(userMessage, context, history, ragContext, webSearchResult, newsDigests)
	fmt.Printf("\n=== LIVE MODEL PROMPT (%s) ===\n%s\n=== END PROMPT ===\n\n", q.model, prompt)
	text, err := q.generate(qwenChatRequest{
		Model: q.model,
		Messages: []qwenMessage{
			{Role: "user", Content: prompt},
		},
	})
	if err != nil {
		return "", err
	}
	fmt.Printf("\n=== LIVE MODEL RESPONSE ===\n%s\n=== END RESPONSE ===\n\n", text)
	return text, nil
}

func (q *QwenClient) GenerateWithPrompt(systemPrompt, userPrompt string) (string, error) {
	return q.generate(qwenChatRequest{
		Model: q.model,
		Messages: []qwenMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})
}

func (q *QwenClient) generate(request qwenChatRequest) (string, error) {
	if !q.Enabled() {
		return "", fmt.Errorf("live model is not configured (set SILICONFLOW_API_KEY)")
	}
	thinkingOff := false
	request.EnableThinking = &thinkingOff
	var lastErr error
	for attempt := 1; attempt <= qwenAttempts; attempt++ {
		text, err := q.generateOnce(request)
		if err == nil {
			return text, nil
		}
		lastErr = err
		if attempt == qwenAttempts || !isRetryableGeminiError(err) {
			break
		}
		log.Printf("Live model %s attempt %d/%d failed (%v); retrying same model", q.model, attempt, qwenAttempts, err)
		time.Sleep(time.Duration(attempt) * 400 * time.Millisecond)
	}
	return "", lastErr
}

func (q *QwenClient) generateOnce(request qwenChatRequest) (string, error) {
	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", qwenCompletionsURL(q.baseURL), bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+q.apiKey)

	resp, err := q.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var chatResp qwenChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}
	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("empty response from API")
	}
	msg := chatResp.Choices[0].Message
	text := strings.TrimSpace(msg.Content)
	if text == "" {
		text = strings.TrimSpace(msg.ReasoningContent)
	}
	if text == "" {
		return "", fmt.Errorf("empty response from API")
	}
	return text, nil
}
