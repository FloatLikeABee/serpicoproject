package ai

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

const pursuitEvalSystemPrompt = `You are Serpico Pursuit Exam Instructor — an expert Olathe PD pursuit strategy evaluator.

Analyze the player's pursuit exam round statistics: their unit assignments, speed matching, resource consumption (limited police vs many suspects), units lost mid-round, and catch rate.

Grade ONLY with letter A, B, or C:
- A: Excellent strategy — strong speed matching, efficient resource use, high catch rate despite constraints
- B: Adequate strategy — partial success with room to improve assignment timing or unit selection
- C: Poor strategy — wasted resources, bad speed matching, low catch rate, or failure to adapt to down units

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

	userPrompt := fmt.Sprintf(`Evaluate this Pursuit Exam round.

Round statistics JSON:
%s

Knowledge base:
%s

Return JSON:
{
  "grade": "A|B|C",
  "score": 0,
  "summary": "one sentence overall verdict",
  "strategyAnalysis": "2-3 sentences on pursuit decisions and timing",
  "resourceAnalysis": "2-3 sentences on police unit consumption vs suspect count",
  "strengths": ["", ""],
  "improvements": ["", ""]
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
	summary := "Resource strain and low apprehension rate indicate strategy gaps."
	strategy := fmt.Sprintf("You launched %d pursuits with %d police against %d suspects. Caught %d, lost %d units mid-round.",
		stats.PursuitsLaunched, stats.TotalPolice, stats.TotalPerps, stats.Caught, stats.PoliceDown)
	resource := fmt.Sprintf("Police-to-suspect ratio was %d:%d — each unit covered %.1f suspects on average.",
		stats.TotalPolice, stats.TotalPerps, float64(stats.TotalPerps)/float64(max(stats.TotalPolice, 1)))

	if catchRate >= 0.75 && stats.PursuitsLaunched > 0 && stats.PoliceUsed <= stats.TotalPolice {
		grade = "A"
		score = 92
		summary = "Strong operational efficiency — good catch rate with disciplined resource use."
	} else if catchRate >= 0.4 || stats.Caught >= 2 {
		grade = "B"
		score = 76
		summary = "Partial success — assignments worked but coverage or speed matching can improve."
	}

	strengths := []string{"Engaged multiple pursuit assignments under pressure"}
	improvements := []string{"Match faster interceptors to fleeing suspects", "Prioritize targets before units go down"}
	if catchRate >= 0.5 {
		strengths = append(strengths, "Maintained effective pressure on suspect vehicles")
	}
	if stats.PoliceDown > 0 {
		improvements = append(improvements, "Build redundancy — don't rely on units that may go offline")
	}

	return &PursuitAIEvaluation{
		Grade:            grade,
		Score:            score,
		Summary:          summary,
		StrategyAnalysis: strategy,
		ResourceAnalysis: resource,
		Strengths:        strengths,
		Improvements:     improvements,
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
