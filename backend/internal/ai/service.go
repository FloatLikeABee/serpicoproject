package ai

import (
	"fmt"
	"log"
	"strings"

	"database/sql"
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
	Mysteries   *MysteriesService
	DailyIntel  *DailyIntelService
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
	service.DailyIntel = NewDailyIntelService(
		service,
		config.IntelDataPath,
		config.EnableDailyIntel,
		config.IntelIntervalHours,
		config.IntelPiecesPerRun,
	)

	return service, nil
}

// AttachMysteries wires the mysteries desk after DB is available.
func (s *AIService) AttachMysteries(db *sql.DB) {
	s.Mysteries = NewMysteriesService(db, s)
}

// ProcessChat handles a chat message and returns AI response
func (s *AIService) ProcessChat(userMessage string, context string, history []ChatHistoryMessage) (string, error) {
	// Step 1: Screen the prompt (only filters jibberish now)
	shouldProcess, _ := s.screener.ScreenPrompt(userMessage)
	if !shouldProcess {
		return "**Copy that** — I didn't catch that transmission. Please rephrase your question in a full sentence.", nil
	}

	placeTag := isPlaceTagContext(context)

	// Step 2: Admin knowledge base (RAG) — includes backstage auto_intel docs.
	// Map pins skip RAG entirely: Search(userMessage+" in-pursue-place") ranks
	// chase-game SOPs (foot pursuit protocol) because the context slug matches
	// "pursue", and those records are not about the tapped address.
	var ragResults []RAGDocument
	if placeTag {
		log.Printf("Place-tag RAG skipped (pin location brief, not department SOPs)")
	} else {
		ragResults = s.rag.Search(userMessage+" "+context, 8)
		log.Printf("RAG search returned %d results (admin knowledge preferred)", len(ragResults))
	}

	// Step 3: Admin MD digests from backstage collection (priority with RAG).
	// Skip for map pins — Olathe digests must not leak onto a New York tag.
	var newsDigests string
	if !placeTag && s.DailyIntel != nil {
		newsDigests = s.DailyIntel.NewsContextForQuery(userMessage+" "+context, 4)
		if newsDigests != "" {
			log.Printf("Admin news digests injected for frontline chat")
		}
	}

	// Step 4: Web search. Map pins search the pin address; other chat stays supplemental.
	var webResult string
	needsLive := NeedsCrimeDataWebSearch(userMessage, context)
	adminCovered := len(ragResults) > 0 || (!placeTag && s.DailyIntel != nil && s.DailyIntel.HasDigestCoverage(userMessage+" "+context))
	if s.config.EnableWebSearch && needsLive {
		query := userMessage + " " + context
		if placeTag {
			query = placeTagWebQuery(userMessage)
		}
		log.Printf("Web search triggered (placeTag=%v adminCovered=%v query=%q)", placeTag, adminCovered, compactQuery(query, 120))
		result, err := s.webSearch.Search(query)
		if err != nil {
			log.Printf("Web search error: %v", err)
			webResult = ""
		} else {
			webResult = result
		}
	}

	// Step 5: Generate response using Gemini, fallback to Mistral if unavailable
	response, err := s.gemini.GenerateResponse(userMessage, context, history, ragResults, webResult, newsDigests)
	if err != nil {
		log.Printf("Gemini API error: %v", err)

		// Check if it's a service unavailable error (503, 429, etc.) and try Mistral
		if s.isServiceUnavailable(err) {
			log.Printf("Gemini unavailable, trying Mistral as fallback")
			mistralResponse, mistralErr := s.mistral.GenerateResponse(userMessage, context, history, ragResults, webResult, newsDigests)
			if mistralErr != nil {
				log.Printf("Mistral API error: %v", mistralErr)
				// Fallback response
				return s.generateFallbackResponse(userMessage, ragResults, context, webResult), nil
			}
			return mistralResponse, nil
		}

		// For other errors, try Mistral anyway
		log.Printf("Trying Mistral as fallback")
		mistralResponse, mistralErr := s.mistral.GenerateResponse(userMessage, context, history, ragResults, webResult, newsDigests)
		if mistralErr != nil {
			log.Printf("Mistral API error: %v", mistralErr)
			// Fallback response
			return s.generateFallbackResponse(userMessage, ragResults, context, webResult), nil
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

func (s *AIService) generateFallbackResponse(query string, ragDocs []RAGDocument, context string, webResult string) string {
	if isPlaceTagContext(context) {
		return generatePlaceTagFallback(query, webResult)
	}
	if len(ragDocs) > 0 {
		return fmt.Sprintf("**Copy that.** Here's what I pulled from department records:\n\n%s\n\n*Intel may be incomplete — confirm through official channels before action.*", ragDocs[0].Content)
	}
	return "**Heads up** — I'm having trouble reaching dispatch systems right now. Try rephrasing your question or ask about pursuit tactics, case files, or area intel."
}

// GetRAGDatabase returns the RAG database for direct access
func (s *AIService) GetRAGDatabase() *RAGDatabase {
	return s.rag
}
