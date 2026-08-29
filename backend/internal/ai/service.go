package ai

import (
	"database/sql"
	"errors"
	"fmt"
	"log"
)

// AIService coordinates all AI functionality
type AIService struct {
	config      *Config
	qwen        *QwenClient
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
	qwen := NewQwenClient(config.QwenAPIKey, config.QwenModel, config.QwenBaseURL)
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

	if qwen.Enabled() {
		log.Printf("Live AI model: %s @ %s", qwen.model, qwen.baseURL)
	} else {
		log.Printf("Live AI model is not configured — set SILICONFLOW_API_KEY (model=%s)", config.QwenModel)
	}

	service := &AIService{
		config:    config,
		qwen:      qwen,
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

	slug := contextSlug(context)

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
	needsLive := NeedsCrimeDataWebSearch(userMessage, slug)
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

	// Step 5: Always use SiliconFlow DeepSeek-V4-Flash (same model for every
	// nation, interview, map-tag brief, and helper). Do not switch to Gemini or Mistral.
	response, err := s.generateChat(userMessage, context, history, ragResults, webResult, newsDigests)
	if err != nil {
		model := defaultLiveModel
		if s.config != nil && s.config.QwenModel != "" {
			model = s.config.QwenModel
		}
		var le *liveModelCallError
		if errors.As(err, &le) {
			log.Printf("Live model API error class=%s status=%d host=%s model=%s: %s", le.Class, le.Status, le.Host, le.Model, le.Msg)
		} else {
			log.Printf("Live model API error (%s): %v", model, err)
		}
		return s.generateFallbackResponse(userMessage, ragResults, context, webResult), nil
	}

	return response, nil
}

func (s *AIService) generateChat(userMessage, context string, history []ChatHistoryMessage, ragResults []RAGDocument, webResult, newsDigests string) (string, error) {
	if s.qwen == nil || !s.qwen.Enabled() {
		return "", fmt.Errorf("live model is not configured (set SILICONFLOW_API_KEY)")
	}
	return s.qwen.GenerateResponse(userMessage, context, history, ragResults, webResult, newsDigests)
}

func (s *AIService) generateWithLiveModel(systemPrompt, userPrompt string) (string, error) {
	if s == nil || s.qwen == nil || !s.qwen.Enabled() {
		return "", fmt.Errorf("live model is not configured (set SILICONFLOW_API_KEY)")
	}
	return s.qwen.GenerateWithPrompt(systemPrompt, userPrompt)
}

func (s *AIService) generateFallbackResponse(query string, ragDocs []RAGDocument, context string, webResult string) string {
	nation := nationFromContext(context)
	if isPlaceTagContext(context) {
		return generatePlaceTagFallback(query, webResult, nation)
	}
	if nation == "cn" {
		if isSuspectInterviewContext(context) || contextSlug(context) == "investigation-helper" {
			return cnInterviewFallback
		}
		return cnChatFallback
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
