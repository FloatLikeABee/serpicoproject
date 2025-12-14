package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

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
			Timeout: 30 * time.Second,
		},
	}
}

// ChatRequest represents a chat request to Gemini
type ChatRequest struct {
	Contents []Content `json:"contents"`
	Tools    []Tool    `json:"tools,omitempty"`
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
	Candidates []Candidate `json:"candidates"`
}

type Candidate struct {
	Content Content `json:"content"`
}

// GenerateResponse generates a response using Gemini API with RAG context
func (g *GeminiClient) GenerateResponse(userMessage string, ragContext []RAGDocument, webSearchResult string) (string, error) {
	// Build context from RAG documents
	context := g.buildContext(ragContext, webSearchResult)
	
	// Build the prompt
	prompt := fmt.Sprintf(`You are an AI assistant for Olathe Police Department. You help officers and civilians with crime-related information, pursuit strategies, and case data.

Context from knowledge base:
%s

Web search results:
%s

User question: %s

Provide a helpful, accurate response based on the context. If the information is not in the context, say so. Always prioritize safety and official procedures.`, context, webSearchResult, userMessage)

	// Prepare request
	request := ChatRequest{
		Contents: []Content{
			{
				Parts: []Part{
					{Text: prompt},
				},
			},
		},
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make API call
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

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	// Parse response
	var chatResp ChatResponse
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(chatResp.Candidates) == 0 || len(chatResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from API")
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

