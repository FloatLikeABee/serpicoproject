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

const geminiAttempts = 3

// GeminiClient handles communication with Google Gemini API
type GeminiClient struct {
	apiKey string
	model  string
	client *http.Client
}

func NewGeminiClient(apiKey, model string) *GeminiClient {
	return &GeminiClient{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{
			Timeout: 55 * time.Second,
		},
	}
}

// ChatRequest represents a chat request to Gemini
type ChatRequest struct {
	Contents          []Content         `json:"contents"`
	Tools             []Tool            `json:"tools,omitempty"`
	SafetySettings    []SafetySetting   `json:"safetySettings,omitempty"`
	GenerationConfig  *GenerationConfig `json:"generationConfig,omitempty"`
}

type SafetySetting struct {
	Category  string `json:"category"`
	Threshold string `json:"threshold"`
}

type GenerationConfig struct {
	Temperature     float64 `json:"temperature,omitempty"`
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
}

type Content struct {
	Parts []Part `json:"parts"`
	Role  string `json:"role,omitempty"`
}

type Part struct {
	Text string `json:"text,omitempty"`
}

type Tool struct {
	FunctionDeclarations []FunctionDeclaration `json:"functionDeclarations,omitempty"`
}

type FunctionDeclaration struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Parameters  interface{} `json:"parameters,omitempty"`
}

// ChatResponse represents the response from Gemini
type ChatResponse struct {
	Candidates     []Candidate      `json:"candidates"`
	PromptFeedback *PromptFeedback  `json:"promptFeedback,omitempty"`
}

type Candidate struct {
	Content      Content `json:"content"`
	FinishReason string  `json:"finishReason"`
}

type PromptFeedback struct {
	BlockReason string `json:"blockReason"`
}

func defaultSafetySettings() []SafetySetting {
	// Police interview / crime-scene coaching is blocked under default Gemini
	// thresholds; use the same permissive settings for every locale.
	cats := []string{
		"HARM_CATEGORY_HARASSMENT",
		"HARM_CATEGORY_HATE_SPEECH",
		"HARM_CATEGORY_SEXUALLY_EXPLICIT",
		"HARM_CATEGORY_DANGEROUS_CONTENT",
	}
	out := make([]SafetySetting, 0, len(cats))
	for _, c := range cats {
		out = append(out, SafetySetting{Category: c, Threshold: "BLOCK_NONE"})
	}
	return out
}

func newGeminiChatRequest(prompt string) ChatRequest {
	return ChatRequest{
		Contents: []Content{
			{Parts: []Part{{Text: prompt}}},
		},
		SafetySettings: defaultSafetySettings(),
		GenerationConfig: &GenerationConfig{
			Temperature:     0.7,
			MaxOutputTokens: 4096,
		},
	}
}

func isRetryableGeminiError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	return strings.Contains(errStr, "429") ||
		strings.Contains(errStr, "500") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "unavailable") ||
		strings.Contains(errStr, "overloaded") ||
		strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "deadline") ||
		strings.Contains(errStr, "empty response") ||
		strings.Contains(errStr, "blocked") ||
		strings.Contains(errStr, "safety")
}

// GenerateResponse generates a response using Gemini API with RAG context
func (g *GeminiClient) GenerateResponse(userMessage, context string, history []ChatHistoryMessage, ragContext []RAGDocument, webSearchResult, newsDigests string) (string, error) {
	prompt := BuildChatPrompt(userMessage, context, history, ragContext, webSearchResult, newsDigests)
	fmt.Printf("\n=== GEMINI PROMPT ===\n%s\n=== END PROMPT ===\n\n", prompt)
	responseText, err := g.generateContent(prompt)
	if err != nil {
		return "", err
	}
	fmt.Printf("\n=== GEMINI RESPONSE ===\n%s\n=== END RESPONSE ===\n\n", responseText)
	return responseText, nil
}

// GenerateWithPrompt sends a custom system + user prompt to Gemini.
func (g *GeminiClient) GenerateWithPrompt(systemPrompt, userPrompt string) (string, error) {
	prompt := fmt.Sprintf("%s\n\n%s", systemPrompt, userPrompt)
	return g.generateContent(prompt)
}

func (g *GeminiClient) generateContent(prompt string) (string, error) {
	var lastErr error
	for attempt := 1; attempt <= geminiAttempts; attempt++ {
		text, err := g.generateContentOnce(prompt)
		if err == nil {
			return text, nil
		}
		lastErr = err
		if attempt == geminiAttempts || !isRetryableGeminiError(err) {
			break
		}
		log.Printf("Gemini %s attempt %d/%d failed (%v); retrying same model", g.model, attempt, geminiAttempts, err)
		time.Sleep(time.Duration(attempt) * 400 * time.Millisecond)
	}
	return "", lastErr
}

func (g *GeminiClient) generateContentOnce(prompt string) (string, error) {
	request := newGeminiChatRequest(prompt)

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", g.model, g.apiKey)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if chatResp.PromptFeedback != nil && strings.TrimSpace(chatResp.PromptFeedback.BlockReason) != "" {
		return "", fmt.Errorf("empty response from API: blocked (%s)", chatResp.PromptFeedback.BlockReason)
	}

	if len(chatResp.Candidates) == 0 || len(chatResp.Candidates[0].Content.Parts) == 0 {
		reason := ""
		if len(chatResp.Candidates) > 0 {
			reason = chatResp.Candidates[0].FinishReason
		}
		if reason == "" {
			return "", fmt.Errorf("empty response from API")
		}
		return "", fmt.Errorf("empty response from API (%s)", reason)
	}

	return chatResp.Candidates[0].Content.Parts[0].Text, nil
}

func (g *GeminiClient) buildContext(ragDocs []RAGDocument, webSearch string) string {
	if len(ragDocs) == 0 && webSearch == "" {
		return "No relevant context found."
	}

	var context strings.Builder
	context.WriteString("Relevant information:\n\n")

	for i, doc := range ragDocs {
		context.WriteString(fmt.Sprintf("[%d] %s\n", i+1, doc.Title))
		context.WriteString(fmt.Sprintf("Category: %s\n", doc.Category))
		if doc.Location != "" {
			context.WriteString(fmt.Sprintf("Location: %s\n", doc.Location))
		}
		context.WriteString(fmt.Sprintf("Content: %s\n\n", doc.Content))
	}

	return context.String()
}

