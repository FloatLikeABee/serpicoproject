package ai

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"time"
)

const (
	defaultLiveModel    = "deepseek-ai/DeepSeek-V4-Flash"
	defaultLiveBaseURL  = "https://api.siliconflow.com/v1"
	chinaLiveBaseURL    = "https://api.siliconflow.cn/v1"
	qwenAttempts        = 3
	knownInvalidLiveKey = "sk-bdyzoncdtphfzkuobciwamljfykkooyenxknyhoulvyqpyzoq"
)

const (
	liveErrAuth    = "auth"
	liveErrTimeout = "timeout"
	liveErrNetwork = "network"
	liveErrAPI     = "api"
)

// defaultQwenModel / defaultQwenBaseURL are aliases used by older call sites.
const (
	defaultQwenModel   = defaultLiveModel
	defaultQwenBaseURL = defaultLiveBaseURL
)

// QwenClient calls an OpenAI-compatible chat completions API (SiliconFlow).
type QwenClient struct {
	apiKey      string
	model       string
	baseURL     string
	peerBaseURL string // tests only; production uses siliconFlowPeerHost
	client      *http.Client
}

func NewQwenClient(apiKey, model, baseURL string) *QwenClient {
	return &QwenClient{
		apiKey:  sanitizeAPIKey(apiKey),
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

func sanitizeAPIKey(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "\ufeff")
	s = strings.TrimSpace(s)
	s = strings.Trim(s, `"'`)
	s = strings.TrimSpace(s)
	if len(s) >= 7 && strings.EqualFold(s[:7], "bearer ") {
		s = strings.TrimSpace(s[7:])
	}
	return strings.TrimSpace(s)
}

func isKnownInvalidLiveKey(key string) bool {
	return sanitizeAPIKey(key) == knownInvalidLiveKey
}

func siliconFlowPeerHost(base string) string {
	l := strings.ToLower(base)
	switch {
	case strings.Contains(l, "siliconflow.cn"):
		return defaultLiveBaseURL
	case strings.Contains(l, "siliconflow.com"):
		return chinaLiveBaseURL
	default:
		return ""
	}
}

func (q *QwenClient) peerHost() string {
	if q != nil && strings.TrimSpace(q.peerBaseURL) != "" {
		return strings.TrimSpace(q.peerBaseURL)
	}
	if q == nil {
		return ""
	}
	return siliconFlowPeerHost(q.baseURL)
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

type liveModelCallError struct {
	Class  string
	Status int
	Host   string
	Model  string
	Msg    string
	Err    error
}

func (e *liveModelCallError) Error() string {
	if e == nil {
		return "live model error"
	}
	return fmt.Sprintf("live model class=%s status=%d host=%s model=%s: %s", e.Class, e.Status, e.Host, e.Model, e.Msg)
}

func (e *liveModelCallError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Err
}

func classifyTransportError(err error) string {
	if err == nil {
		return liveErrNetwork
	}
	var ne net.Error
	if errors.As(err, &ne) && ne.Timeout() {
		return liveErrTimeout
	}
	s := strings.ToLower(err.Error())
	if strings.Contains(s, "timeout") || strings.Contains(s, "deadline") {
		return liveErrTimeout
	}
	return liveErrNetwork
}

func classifyHTTPStatus(status int, body string) string {
	lower := strings.ToLower(body)
	if status == http.StatusUnauthorized || strings.Contains(lower, "api key is invalid") || strings.Contains(lower, "token is invalid") {
		return liveErrAuth
	}
	return liveErrAPI
}

func isRetryableLiveError(err error) bool {
	var le *liveModelCallError
	if errors.As(err, &le) {
		if le.Class == liveErrAuth {
			return false
		}
		if le.Class == liveErrTimeout || le.Class == liveErrNetwork {
			return true
		}
		if le.Status == http.StatusTooManyRequests || le.Status >= 500 {
			return true
		}
		return false
	}
	return isRetryableGeminiError(err)
}

func (q *QwenClient) generate(request qwenChatRequest) (string, error) {
	if !q.Enabled() {
		return "", fmt.Errorf("live model is not configured (set SILICONFLOW_API_KEY)")
	}
	thinkingOff := false
	request.EnableThinking = &thinkingOff
	var lastErr error
	bases := []string{q.baseURL}
	if peer := q.peerHost(); peer != "" && peer != q.baseURL {
		bases = append(bases, peer)
	}
	for _, base := range bases {
		for attempt := 1; attempt <= qwenAttempts; attempt++ {
			text, err := q.generateOnce(request, base)
			if err == nil {
				if base != q.baseURL {
					log.Printf("Live model succeeded on peer host %s (configured %s)", base, q.baseURL)
					q.baseURL = base
				}
				return text, nil
			}
			lastErr = err
			var le *liveModelCallError
			if errors.As(err, &le) {
				log.Printf("Live model class=%s status=%d host=%s model=%s attempt %d/%d: %s", le.Class, le.Status, le.Host, le.Model, attempt, qwenAttempts, le.Msg)
				if le.Class == liveErrAuth {
					break
				}
			} else {
				log.Printf("Live model %s @ %s attempt %d/%d failed (%v)", q.model, base, attempt, qwenAttempts, err)
			}
			if attempt == qwenAttempts || !isRetryableLiveError(err) {
				break
			}
			time.Sleep(time.Duration(attempt) * 400 * time.Millisecond)
		}
	}
	return "", lastErr
}

func (q *QwenClient) generateOnce(request qwenChatRequest, baseURL string) (string, error) {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = q.baseURL
	}
	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", qwenCompletionsURL(baseURL), bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+q.apiKey)

	resp, err := q.client.Do(req)
	if err != nil {
		return "", &liveModelCallError{
			Class: classifyTransportError(err),
			Host:  baseURL,
			Model: q.model,
			Msg:   err.Error(),
			Err:   err,
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		msg := strings.TrimSpace(string(body))
		return "", &liveModelCallError{
			Class:  classifyHTTPStatus(resp.StatusCode, msg),
			Status: resp.StatusCode,
			Host:   baseURL,
			Model:  q.model,
			Msg:    msg,
		}
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
