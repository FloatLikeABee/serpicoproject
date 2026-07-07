package ai

import (
	"fmt"
	"log"
	"strings"
)

// AIService coordinates all AI functionality
type AIService struct {
	config      *Config
	gemini      *GeminiClient
	mistral     *MistralClient
	rag         *RAGDatabase
	webSearch   *WebSearchTool
	screener    *PromptScreener
	ChaseGame   *ChaseGameService
	PursuitExam *PursuitExamService
}

func NewAIService(config *Config) (*AIService, error) {
	gemini := NewGeminiClient(config.GeminiAPIKey, config.GeminiModel)
	mistral := NewMistralClient(config.MistralAPIKey, config.MistralModel)
	
	rag, err := NewRAGDatabase(config.RAGDataPath)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize RAG database: %w", err)
	}
	rag.EnsureChaseGameDocuments()

	webSearch := NewWebSearchTool(config.EnableWebSearch)
	screener := NewPromptScreener()
	imageGen := NewImageGenerator(config)

	service := &AIService{
		config:    config,
		gemini:    gemini,
		mistral:   mistral,
		rag:       rag,
		webSearch: webSearch,
		screener:  screener,
	}
	service.ChaseGame = NewChaseGameService(service, imageGen, config.ChaseGameMaxRounds)
	service.PursuitExam = NewPursuitExamService()

	return service, nil
}

// ProcessChat handles a chat message and returns AI response
func (s *AIService) ProcessChat(userMessage string, context string) (string, error) {
	// Step 1: Screen the prompt (only filters jibberish now)
	shouldProcess, _ := s.screener.ScreenPrompt(userMessage)
	if !shouldProcess {
		return "**Copy that** — I didn't catch that transmission. Please rephrase your question in a full sentence.", nil
	}

	// Step 2: Search RAG database (optional - for relevant context)
	ragResults := s.rag.Search(userMessage+" "+context, 5)
	log.Printf("RAG search returned %d results", len(ragResults))

	// Step 3: Web search only when the prompt needs live crime data
	var webResult string
	if s.config.EnableWebSearch && NeedsCrimeDataWebSearch(userMessage, context) {
		log.Printf("Crime-data web search triggered for query")
		result, err := s.webSearch.Search(userMessage + " " + context)
		if err != nil {
			log.Printf("Web search error: %v", err)
			webResult = ""
		} else {
			webResult = result
		}
	}

	// Step 4: Generate response using Gemini, fallback to Mistral if unavailable
	response, err := s.gemini.GenerateResponse(userMessage, context, ragResults, webResult)
	if err != nil {
		log.Printf("Gemini API error: %v", err)
		
		// Check if it's a service unavailable error (503, 429, etc.) and try Mistral
		if s.isServiceUnavailable(err) {
			log.Printf("Gemini unavailable, trying Mistral as fallback")
			mistralResponse, mistralErr := s.mistral.GenerateResponse(userMessage, context, ragResults, webResult)
			if mistralErr != nil {
				log.Printf("Mistral API error: %v", mistralErr)
				// Fallback response
				return s.generateFallbackResponse(userMessage, ragResults), nil
			}
			return mistralResponse, nil
		}
		
		// For other errors, try Mistral anyway
		log.Printf("Trying Mistral as fallback")
		mistralResponse, mistralErr := s.mistral.GenerateResponse(userMessage, context, ragResults, webResult)
		if mistralErr != nil {
			log.Printf("Mistral API error: %v", mistralErr)
			// Fallback response
			return s.generateFallbackResponse(userMessage, ragResults), nil
		}
		return mistralResponse, nil
	}

	return response, nil
}

// isServiceUnavailable checks if the error indicates service unavailability
func (s *AIService) isServiceUnavailable(err error) bool {
	errStr := strings.ToLower(err.Error())
	// Check for common service unavailable status codes
	return strings.Contains(errStr, "503") || 
		   strings.Contains(errStr, "429") || 
		   strings.Contains(errStr, "unavailable") || 
		   strings.Contains(errStr, "overloaded")
}

func (s *AIService) generateFallbackResponse(query string, ragDocs []RAGDocument) string {
	if len(ragDocs) > 0 {
		return fmt.Sprintf("**Copy that.** Here's what I pulled from department records:\n\n%s\n\n*Intel may be incomplete — confirm through official channels before action.*", ragDocs[0].Content)
	}
	return "**Heads up** — I'm having trouble reaching dispatch systems right now. Try rephrasing your question or ask about pursuit tactics, case files, or area intel."
}

// GetRAGDatabase returns the RAG database for direct access
func (s *AIService) GetRAGDatabase() *RAGDatabase {
	return s.rag
}

