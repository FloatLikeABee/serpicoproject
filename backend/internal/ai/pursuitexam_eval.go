package ai

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

const pursuitEvalSystemPrompt = `You are Serpico Pursuit Exam Instructor. Give a brief A/B/C grade and a few short sentences — no essays.

Grade ONLY with letter A, B, or C:
- A: strong catch rate and smart unit use
- B: partial success, some gaps
- C: weak results or poor resource use

Keep every text field to 1 short sentence. Strengths and improvements: at most 1 item each.
Respond with ONLY valid JSON. No markdown fences.`

type PursuitDecisionRecord struct {
	PoliceID      string  `json:"policeId"`
	PoliceName    string  `json:"policeName"`
	PoliceSpeed   float64 `json:"policeSpeed"`
	PoliceRank    string  `json:"policeRank,omitempty"`
	VehicleModel  string  `json:"vehicleModel"`
	PerpID        string  `json:"perpId"`
	PerpName      string  `json:"perpName"`
	PerpSpeed     float64 `json:"perpSpeed"`
	PerpModel     string  `json:"perpModel"`
	TimestampMs   int64   `json:"timestampMs"`
	Outcome       string  `json:"outcome,omitempty"`
}

type PoliceStatusRecord struct {
	Name   string  `json:"name"`
	Status string  `json:"status"`
	Model  string  `json:"model"`
	Speed  float64 `json:"speed"`
	Rank   string  `json:"rank,omitempty"`
}

type PursuitRoundStats struct {
	Round             int                     `json:"round"`
	RoundDurationSec  int                     `json:"roundDurationSec"`
	TotalPolice       int                     `json:"totalPolice"`
	TotalPerps        int                     `json:"totalPerps"`
	PoliceDown        int                     `json:"policeDown"`
	PoliceUsed        int                     `json:"policeUsed"`
	PursuitsLaunched  int                     `json:"pursuitsLaunched"`
	Caught            int                     `json:"caught"`
	Escaped           int                     `json:"escaped"`
	Outcome           string                  `json:"outcome"`
	OperationalScore  int                     `json:"operationalScore"`
	Decisions         []PursuitDecisionRecord `json:"decisions"`
	PoliceStatus      []PoliceStatusRecord    `json:"policeStatus"`
}

type PursuitAIEvaluation struct {
	Grade             string   `json:"grade"`
	Score             int      `json:"score"`
	Summary           string   `json:"summary"`
	StrategyAnalysis  string   `json:"strategyAnalysis"`
	ResourceAnalysis  string   `json:"resourceAnalysis"`
	Strengths         []string `json:"strengths"`
	Improvements      []string `json:"improvements"`
}

func (s *AIService) EvaluatePursuitRound(stats PursuitRoundStats) (*PursuitAIEvaluation, error) {
	statsJSON, _ := json.Marshal(stats)
	ragDocs := s.rag.Search("pursuit operation codex strategy containment resource deployment", 6)
	ragContext := s.gemini.buildContext(ragDocs, "")

	userPrompt := fmt.Sprintf(`Briefly evaluate this Pursuit Exam round. Keep the whole review to a few sentences total.

Round statistics JSON:
%s

Optional context (use lightly):
%s

Return JSON:
{
  "grade": "A|B|C",
  "score": 0,
  "summary": "one short sentence",
  "strategyAnalysis": "one short sentence",
  "resourceAnalysis": "one short sentence",
  "strengths": ["one short phrase"],
  "improvements": ["one short phrase"]
}`, string(statsJSON), ragContext)

	raw, err := s.generateGameJSON(pursuitEvalSystemPrompt, userPrompt)
	if err != nil {
		log.Printf("Pursuit eval AI error: %v", err)
		return fallbackPursuitEvaluation(stats), nil
	}

	var eval PursuitAIEvaluation
	if err := json.Unmarshal([]byte(extractJSON(raw)), &eval); err != nil {
		log.Printf("Pursuit eval parse error: %v", err)
		return fallbackPursuitEvaluation(stats), nil
	}

	eval.Grade = normalizePursuitGrade(eval.Grade)
	if eval.Score <= 0 {
		eval.Score = gradeToScore(eval.Grade)
	}
	if eval.Summary == "" {
		eval.Summary = fallbackPursuitEvaluation(stats).Summary
	}
	return &eval, nil
}

func normalizePursuitGrade(g string) string {
	g = strings.ToUpper(strings.TrimSpace(g))
	if len(g) > 0 {
		switch g[0] {
		case 'A':
			return "A"
		case 'B':
			return "B"
		default:
			return "C"
		}
	}
	return "C"
}

func gradeToScore(grade string) int {
	switch grade {
	case "A":
		return 90
	case "B":
		return 75
	default:
		return 55
	}
}

func fallbackPursuitEvaluation(stats PursuitRoundStats) *PursuitAIEvaluation {
	catchRate := 0.0
	if stats.TotalPerps > 0 {
		catchRate = float64(stats.Caught) / float64(stats.TotalPerps)
	}

	grade := "C"
	score := 55
	summary := "Low catch rate under a heavy suspect load."
	strategy := fmt.Sprintf("Launched %d pursuits; caught %d of %d.", stats.PursuitsLaunched, stats.Caught, stats.TotalPerps)
	resource := fmt.Sprintf("Used %d of %d police vs %d suspects.", stats.PoliceUsed, stats.TotalPolice, stats.TotalPerps)

	if catchRate >= 0.75 && stats.PursuitsLaunched > 0 && stats.PoliceUsed <= stats.TotalPolice {
		grade = "A"
		score = 92
		summary = "Strong catch rate with disciplined unit use."
	} else if catchRate >= 0.4 || stats.Caught >= 2 {
		grade = "B"
		score = 76
		summary = "Partial success — tighten target priority next round."
	}

	strengths := []string{"Kept pressure on active pursuits"}
	improvements := []string{"Deploy backups earlier on escaping targets"}
	if catchRate < 0.4 {
		strengths = []string{"Engaged under difficult odds"}
	}

	return &PursuitAIEvaluation{
		Grade:            grade,
		Score:            score,
		Summary:          summary,
		StrategyAnalysis: strategy,
		ResourceAnalysis: resource,
		Strengths:        strengths[:1],
		Improvements:     improvements[:1],
	}
}

