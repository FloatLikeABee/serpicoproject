package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// MistralClient handles communication with Mistral AI API
type MistralClient struct {
	apiKey string
	model  string
	client *http.Client
}

func NewMistralClient(apiKey, model string) *MistralClient {
	return &MistralClient{
		apiKey: apiKey,
		model:  model,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// MistralChatRequest represents a chat request to Mistral
type MistralChatRequest struct {
	Model    string          `json:"model"`
	Messages []MistralMessage `json:"messages"`
}

type MistralMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// MistralChatResponse represents the response from Mistral API
type MistralChatResponse struct {
	Choices []MistralChoice `json:"choices"`
}

type MistralChoice struct {
	Message MistralMessage `json:"message"`
}

// GenerateResponse generates a response using Mistral API with RAG context
func (m *MistralClient) GenerateResponse(userMessage, context string, history []ChatHistoryMessage, ragContext []RAGDocument, webSearchResult, newsDigests string) (string, error) {
	prompt := BuildChatPrompt(userMessage, context, history, ragContext, webSearchResult, newsDigests)

	// Print prompt to console
	fmt.Printf("\n=== MISTRAL PROMPT ===\n%s\n=== END PROMPT ===\n\n", prompt)

	// Prepare request
	request := MistralChatRequest{
		Model: m.model,
		Messages: []MistralMessage{
			{
				Role:    "user",
				Content: prompt,
			},
		},
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make API call
	url := "https://api.mistral.ai/v1/chat/completions"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.apiKey)

	resp, err := m.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	// Parse response
	var chatResp MistralChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("empty response from API")
	}

	responseText := chatResp.Choices[0].Message.Content
	
	// Print response to console
	fmt.Printf("\n=== MISTRAL RESPONSE ===\n%s\n=== END RESPONSE ===\n\n", responseText)

	return responseText, nil
}

// GenerateWithPrompt sends a custom system + user prompt to Mistral.
func (m *MistralClient) GenerateWithPrompt(systemPrompt, userPrompt string) (string, error) {
	request := MistralChatRequest{
		Model: m.model,
		Messages: []MistralMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.mistral.ai/v1/chat/completions", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+m.apiKey)

	resp, err := m.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	var chatResp MistralChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}
	if len(chatResp.Choices) == 0 || chatResp.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("empty response from API")
	}
	return chatResp.Choices[0].Message.Content, nil
}

func (m *MistralClient) buildContext(ragDocs []RAGDocument, webSearch string) string {
	if len(ragDocs) == 0 && webSearch == "" {
		return "No relevant context found."
	}

	var context bytes.Buffer
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

