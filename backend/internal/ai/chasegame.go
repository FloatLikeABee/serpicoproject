package ai

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const chaseGameSystemPrompt = `You are the Serpico Chase Game Game Master — an energetic police training simulator for vehicle and foot pursuits.

Rules:
- Ground every scenario in real police pursuit doctrine (containment, distance, backup, public safety, termination criteria).
- Reference the provided operation codex and specimen case studies when scoring and debriefing.
- Keep tone fun and cinematic like a training game, not a dry exam. Use brief emoji sparingly (1-2 max per message).
- Always respond with ONLY valid JSON matching the requested schema. No markdown fences.
- For twists, escalate realistically: suspect actions, civilian traffic, weather, radio intel, foot bail-out, etc.
- Scoring must cite codex principles (e.g., IACP pursuit policy, Olathe PD protocols).`

type ChaseScenario struct {
	Title            string `json:"title"`
	Setting          string `json:"setting"`
	Situation        string `json:"situation"`
	SuspectProfile   string `json:"suspectProfile"`
	VehiclePhase     string `json:"vehiclePhase"`
	FootPhase        string `json:"footPhase"`
	CodexReference   string `json:"codexReference"`
	CaseStudyRef     string `json:"caseStudyRef"`
	ImagePrompt      string `json:"imagePrompt"`
	OpeningQuestion  string `json:"openingQuestion"`
	FunHook          string `json:"funHook"`
}

type ChaseTurnResponse struct {
	Narrative       string `json:"narrative"`
	Twist           string `json:"twist"`
	Question        string `json:"question"`
	Hint            string `json:"hint"`
	ReactionEmoji   string `json:"reactionEmoji"`
	TurnLabel       string `json:"turnLabel"`
}

type ChaseEvaluation struct {
	Score           int      `json:"score"`
	MaxScore        int      `json:"maxScore"`
	Rank            string   `json:"rank"`
	Badge           string   `json:"badge"`
	Summary         string   `json:"summary"`
	Strengths       []string `json:"strengths"`
	Improvements    []string `json:"improvements"`
	CodexAlignment  string   `json:"codexAlignment"`
	CaseStudyNotes  string   `json:"caseStudyNotes"`
	FunClosing      string   `json:"funClosing"`
}

type ChaseTurnRecord struct {
	Turn     int    `json:"turn"`
	Question string `json:"question"`
	Answer   string `json:"answer"`
	Feedback string `json:"feedback,omitempty"`
}

type ChaseGameSession struct {
	ID           string            `json:"id"`
	Phase        string            `json:"phase"`
	Difficulty   string            `json:"difficulty"`
	Turn         int               `json:"turn"`
	MaxTurns     int               `json:"maxTurns"`
	Scenario     *ChaseScenario    `json:"scenario,omitempty"`
	ImageURL     string            `json:"imageUrl,omitempty"`
	CurrentTurn  *ChaseTurnResponse `json:"currentTurn,omitempty"`
	History      []ChaseTurnRecord `json:"history"`
	Evaluation   *ChaseEvaluation  `json:"evaluation,omitempty"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
}

type ChaseGameService struct {
	ai      *AIService
	images  *ImageGenerator
	store   map[string]*ChaseGameSession
	mu      sync.RWMutex
	maxTurn int
}

func NewChaseGameService(ai *AIService, images *ImageGenerator, maxTurns int) *ChaseGameService {
	if maxTurns <= 0 {
		maxTurns = 4
	}
	return &ChaseGameService{
		ai:      ai,
		images:  images,
		store:   make(map[string]*ChaseGameSession),
		maxTurn: maxTurns,
	}
}

func (s *ChaseGameService) StartGame(difficulty string) (*ChaseGameSession, error) {
	difficulty = normalizeDifficulty(difficulty)
	s.ai.rag.EnsureChaseGameDocuments()

	ragDocs := s.ai.rag.Search("chase game pursuit operation codex case study vehicle foot", 8)
	ragContext := s.ai.gemini.buildContext(ragDocs, "")

	scenario, err := s.generateScenario(difficulty, ragContext)
	if err != nil {
		scenario = fallbackScenario(difficulty)
	}

	imageURL, imgErr := s.images.GenerateScenarioImage(scenario.ImagePrompt)
	if imgErr != nil {
		log.Printf("Chase game image generation failed: %v", imgErr)
		imageURL, _ = s.images.GenerateScenarioImage(scenario.ImagePrompt)
	}

	session := &ChaseGameSession{
		ID:         uuid.New().String(),
		Phase:      "round",
		Difficulty: difficulty,
		Turn:       1,
		MaxTurns:   s.maxTurn,
		Scenario:   scenario,
		ImageURL:   imageURL,
		CurrentTurn: &ChaseTurnResponse{
			Narrative:     scenario.Situation + "\n\n" + scenario.FunHook,
			Twist:         scenario.VehiclePhase,
			Question:      scenario.OpeningQuestion,
			Hint:          "Think containment, backup, and public safety first.",
			ReactionEmoji: "🚨",
			TurnLabel:     "Mission Brief — Vehicle Pursuit",
		},
		History:   []ChaseTurnRecord{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	s.mu.Lock()
	s.store[session.ID] = session
	s.mu.Unlock()

	return session, nil
}

func (s *ChaseGameService) Respond(sessionID, answer string) (*ChaseGameSession, error) {
	s.mu.Lock()
	session, ok := s.store[sessionID]
	if !ok {
		s.mu.Unlock()
		return nil, fmt.Errorf("session not found")
	}
	if session.Phase == "evaluation" {
		s.mu.Unlock()
		return session, nil
	}
	if strings.TrimSpace(answer) == "" {
		s.mu.Unlock()
		return nil, fmt.Errorf("answer is required")
	}

	currentQuestion := ""
	if session.CurrentTurn != nil {
		currentQuestion = session.CurrentTurn.Question
	}

	session.History = append(session.History, ChaseTurnRecord{
		Turn:     session.Turn,
		Question: currentQuestion,
		Answer:   answer,
	})
	s.mu.Unlock()

	if session.Turn >= session.MaxTurns {
		eval, err := s.generateEvaluation(session, answer)
		if err != nil {
			eval = fallbackEvaluation(session)
		}

		s.mu.Lock()
		session.Evaluation = eval
		session.Phase = "evaluation"
		session.CurrentTurn = nil
		session.UpdatedAt = time.Now()
		s.mu.Unlock()
		return session, nil
	}

	nextTurn, err := s.generateNextTurn(session, answer)
	if err != nil {
		nextTurn = fallbackNextTurn(session)
	}

	s.mu.Lock()
	session.Turn++
	session.CurrentTurn = nextTurn
	session.UpdatedAt = time.Now()
	s.mu.Unlock()

	return session, nil
}

func (s *ChaseGameService) GetSession(sessionID string) (*ChaseGameSession, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.store[sessionID]
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	return session, nil
}

func (s *ChaseGameService) generateScenario(difficulty, ragContext string) (*ChaseScenario, error) {
	userPrompt := fmt.Sprintf(`Create a fresh police chase training scenario for difficulty "%s".

Use this knowledge base:
%s

Return JSON:
{
  "title": "catchy mission name",
  "setting": "city area and time",
  "situation": "2-3 sentence cinematic setup",
  "suspectProfile": "brief suspect info",
  "vehiclePhase": "initial vehicle pursuit details",
  "footPhase": "anticipated foot pursuit element",
  "codexReference": "which protocol applies",
  "caseStudyRef": "similar real or specimen case",
  "imagePrompt": "photorealistic police pursuit scene description for image AI, no text in image",
  "openingQuestion": "first decision question for the officer",
  "funHook": "one exciting game-style line"
}`, difficulty, ragContext)

	raw, err := s.ai.generateGameJSON(chaseGameSystemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	var scenario ChaseScenario
	if err := json.Unmarshal([]byte(extractJSON(raw)), &scenario); err != nil {
		return nil, err
	}
	return &scenario, nil
}

func (s *ChaseGameService) generateNextTurn(session *ChaseGameSession, answer string) (*ChaseTurnResponse, error) {
	historyJSON, _ := json.Marshal(session.History)
	userPrompt := fmt.Sprintf(`Continue Chase Game session.

Scenario title: %s
Difficulty: %s
Turn: %d of %d
Scenario: %+v
History: %s
Latest officer answer: %s

Escalate with a realistic twist (vehicle OR foot phase). Ask ONE clear decision question.

Return JSON:
{
  "narrative": "brief reaction to their answer",
  "twist": "new complication",
  "question": "what would you do next?",
  "hint": "optional tactical hint",
  "reactionEmoji": "single emoji",
  "turnLabel": "short fun turn title"
}`, session.Scenario.Title, session.Difficulty, session.Turn, session.MaxTurns, session.Scenario, string(historyJSON), answer)

	raw, err := s.ai.generateGameJSON(chaseGameSystemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	var turn ChaseTurnResponse
	if err := json.Unmarshal([]byte(extractJSON(raw)), &turn); err != nil {
		return nil, err
	}
	return &turn, nil
}

func (s *ChaseGameService) generateEvaluation(session *ChaseGameSession, finalAnswer string) (*ChaseEvaluation, error) {
	ragDocs := s.ai.rag.Search("pursuit operation codex case study scoring evaluation", 8)
	ragContext := s.ai.gemini.buildContext(ragDocs, "")
	historyJSON, _ := json.Marshal(session.History)

	userPrompt := fmt.Sprintf(`Final debrief for Chase Game.

Scenario: %+v
Difficulty: %s
Full history: %s
Final answer: %s

Knowledge base for scoring:
%s

Score 0-100 against standard pursuit operation codex and specimen cases.
Assign a fun rank (Rookie / Patrol Pro / Tactical Ace / Pursuit Legend) and badge emoji.

Return JSON:
{
  "score": 0,
  "maxScore": 100,
  "rank": "",
  "badge": "",
  "summary": "",
  "strengths": ["", ""],
  "improvements": ["", ""],
  "codexAlignment": "",
  "caseStudyNotes": "",
  "funClosing": ""
}`, session.Scenario, session.Difficulty, string(historyJSON), finalAnswer, ragContext)

	raw, err := s.ai.generateGameJSON(chaseGameSystemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	var eval ChaseEvaluation
	if err := json.Unmarshal([]byte(extractJSON(raw)), &eval); err != nil {
		return nil, err
	}
	if eval.MaxScore == 0 {
		eval.MaxScore = 100
	}
	return &eval, nil
}

func (s *AIService) generateGameJSON(systemPrompt, userPrompt string) (string, error) {
	response, err := s.gemini.GenerateWithPrompt(systemPrompt, userPrompt)
	if err == nil {
		return response, nil
	}
	log.Printf("Chase game Gemini error: %v", err)
	return s.mistral.GenerateWithPrompt(systemPrompt, userPrompt)
}

func extractJSON(raw string) string {
	raw = strings.TrimSpace(raw)
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start >= 0 && end > start {
		return raw[start : end+1]
	}
	return raw
}

func normalizeDifficulty(difficulty string) string {
	switch strings.ToLower(strings.TrimSpace(difficulty)) {
	case "easy", "medium", "hard":
		return strings.ToLower(difficulty)
	default:
		return "medium"
	}
}

func fallbackScenario(difficulty string) *ChaseScenario {
	scenarios := []ChaseScenario{
		{
			Title:           "Midnight Alley Dash",
			Setting:         "Downtown Olathe, 11:47 PM — rain-slick streets",
			Situation:       "Dispatch flags a stolen sedan blowing stop signs on S Kansas Ave. You initiate a vehicle pursuit with one cover unit rolling. The suspect knows the grid and is heading toward a crowded entertainment block.",
			SuspectProfile:  "Male, 20s, prior fleeing charges, no confirmed weapons intel yet",
			VehiclePhase:    "Suspect weaves through traffic at 65 mph in a 35 zone",
			FootPhase:       "Likely foot bail-out near the parking garage on Cherry St",
			CodexReference:  "Olathe PD Urban Pursuit Protocol — maintain 3-5 car lengths, prioritize containment over speed",
			CaseStudyRef:    "Specimen Case OPS-2019-14: containment + parallel units resolved similar downtown chase without injury",
			ImagePrompt:     "Nighttime urban police vehicle pursuit with sirens, wet asphalt reflections, police SUV chasing sedan downtown",
			OpeningQuestion: "You're lead unit and backup is 90 seconds out. Do you press close, hang back and contain, or attempt a parallel intercept?",
			FunHook:         "Your shift just turned into a live-action pursuit sim — let's see your playbook! 🎮",
		},
		{
			Title:           "Highway Heat",
			Setting:         "I-35 southbound near Olathe, rush hour thinning",
			Situation:       "Armed robbery suspect in a pickup jumps on the highway. State patrol is notified. Traffic is moderate and the suspect is lane-splitting aggressively.",
			SuspectProfile:  "Female, 30s, confirmed handgun in vehicle per witness",
			VehiclePhase:    "Speeds hit 95 mph weaving across three lanes",
			FootPhase:       "Possible exit-ramp bail-out toward industrial park",
			CodexReference:  "Highway Pursuit Protocol — backup, spike strip coordination, PIT only when legally authorized and lanes clear",
			CaseStudyRef:    "Specimen Case HWY-2021-07: spike deployment at exit ramp ended pursuit safely",
			ImagePrompt:     "Highway police pursuit at dusk, police cars chasing pickup truck on interstate with emergency lights",
			OpeningQuestion: "Dispatch asks if you want spike strip teams staged at the next exit. What's your call and why?",
			FunHook:         "High stakes, high speed — treat this like the boss level! 🏁",
		},
	}
	sc := scenarios[rand.Intn(len(scenarios))]
	if difficulty == "easy" {
		sc.OpeningQuestion = "Backup is already with you. What's your first move to keep civilians safe while staying on the suspect?"
	} else if difficulty == "hard" {
		sc.Situation += " A school event just ended two blocks ahead — civilian density is rising fast."
	}
	return &sc
}

func fallbackNextTurn(session *ChaseGameSession) *ChaseTurnResponse {
	labels := []string{"Plot Twist", "Suspect Switch", "Foot Pursuit Phase", "Final Pressure"}
	idx := session.Turn - 1
	if idx >= len(labels) {
		idx = len(labels) - 1
	}
	twists := []string{
		"The suspect clips a median and blows a tire — but keeps driving on the rim toward a residential side street.",
		"Dispatch reports the passenger may be tossing evidence out the window. A civilian dashcam is live-streaming the chase.",
		"The suspect abandons the vehicle in a apartment complex parking lot and sprints toward a stairwell.",
		"K-9 is 4 minutes out. The suspect scales a fence into a poorly lit courtyard with multiple exit points.",
	}
	return &ChaseTurnResponse{
		Narrative:     "Good call — the situation is evolving fast.",
		Twist:         twists[idx],
		Question:      "What's your next move? Coordinate units, adjust pursuit level, or switch to foot containment?",
		Hint:          "Call out roles on the radio: primary, cover, perimeter.",
		ReactionEmoji: "⚡",
		TurnLabel:     labels[idx],
	}
}

func fallbackEvaluation(session *ChaseGameSession) *ChaseEvaluation {
	score := 70 + len(session.History)*5
	if score > 95 {
		score = 95
	}
	rank := "Patrol Pro"
	badge := "🥈"
	if score >= 90 {
		rank = "Pursuit Legend"
		badge = "🏆"
	} else if score < 75 {
		rank = "Rookie"
		badge = "🎖️"
	}
	return &ChaseEvaluation{
		Score:          score,
		MaxScore:       100,
		Rank:           rank,
		Badge:          badge,
		Summary:        "Solid instincts overall. You balanced urgency with public safety in a dynamic pursuit.",
		Strengths:      []string{"Communicated intent clearly", "Considered containment options"},
		Improvements:   []string{"Call backup earlier in high-density areas", "Pre-stage perimeter before foot pursuit"},
		CodexAlignment: "Aligned with urban pursuit protocol: safe distance, parallel units, and termination when risk outweighs benefit.",
		CaseStudyNotes: "Similar to specimen case OPS-2019-14 where perimeter coordination secured arrest without injury.",
		FunClosing:     "Great run, officer! Queue up another scenario when you're ready for a rematch. 🚔",
	}
}
