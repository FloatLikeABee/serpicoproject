package ai

import (
	"fmt"
	"log"
)

// AIService coordinates all AI functionality
type AIService struct {
	config      *Config
	gemini      *GeminiClient
	rag         *RAGDatabase
	webSearch   *WebSearchTool
	screener    *PromptScreener
}

func NewAIService(config *Config) (*AIService, error) {
	gemini := NewGeminiClient(config.GeminiAPIKey, config.GeminiModel)
	
	rag, err := NewRAGDatabase(config.RAGDataPath)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize RAG database: %w", err)
	}

	webSearch := NewWebSearchTool(config.EnableWebSearch)
	screener := NewPromptScreener()

	return &AIService{
		config:    config,
		gemini:    gemini,
		rag:       rag,
		webSearch: webSearch,
		screener:  screener,
	}, nil
}

// ProcessChat handles a chat message and returns AI response
func (s *AIService) ProcessChat(userMessage string, context string) (string, error) {
	// Step 1: Screen the prompt
	shouldProcess, reason := s.screener.ScreenPrompt(userMessage)
	if !shouldProcess {
		return fmt.Sprintf("I'm here to help with Olathe PD related questions. Your message was filtered: %s. Please ask about crime data, pursuit strategies, case information, or officer assistance.", reason), nil
	}

	// Step 2: Search RAG database
	ragResults := s.rag.Search(userMessage+" "+context, 5)
	log.Printf("RAG search returned %d results", len(ragResults))

	// Step 3: Perform web search if enabled
	var webResult string
	if s.config.EnableWebSearch {
		result, err := s.webSearch.Search(userMessage)
		if err != nil {
			log.Printf("Web search error: %v", err)
			webResult = ""
		} else {
			webResult = result
		}
	}

	// Step 4: Generate response using Gemini
	response, err := s.gemini.GenerateResponse(userMessage, ragResults, webResult)
	if err != nil {
		log.Printf("Gemini API error: %v", err)
		// Fallback response
		return s.generateFallbackResponse(userMessage, ragResults), nil
	}

	return response, nil
}

func (s *AIService) generateFallbackResponse(query string, ragDocs []RAGDocument) string {
	if len(ragDocs) > 0 {
		return fmt.Sprintf("Based on Olathe PD records: %s\n\nFor more information, please consult the case files or contact dispatch.", ragDocs[0].Content)
	}
	return "I'm having trouble processing your request right now. Please try rephrasing your question about Olathe PD operations, crime data, or pursuit strategies."
}

// GetRAGDatabase returns the RAG database for direct access
func (s *AIService) GetRAGDatabase() *RAGDatabase {
	return s.rag
}

