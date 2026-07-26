package ai

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
)

const locationTacticsEvalSystemPrompt = `You are Serpico Field Tactics Instructor. Grade a short on-foot raid at a bar, club, factory, or housing project.

Grade ONLY A, B, or C. Keep every text field to one short sentence. Strengths/improvements: at most one item each.
Respond with ONLY valid JSON. No markdown fences.`

// LocationTacticsStats is the payload for indoor/on-foot raid evaluation.
type LocationTacticsStats struct {
	LandmarkID           string   `json:"landmarkId"`
	LandmarkName         string   `json:"landmarkName"`
	LandmarkKind         string   `json:"landmarkKind"`
	DayKey               string   `json:"dayKey"`
	ScenarioTitle        string   `json:"scenarioTitle"`
	TurnsUsed            int      `json:"turnsUsed"`
	TotalPolice          int      `json:"totalPolice"`
	PoliceHurt           int      `json:"policeHurt"`
	PoliceUsed           int      `json:"policeUsed"`
	TotalPerps           int      `json:"totalPerps"`
	ArmedPerps           int      `json:"armedPerps"`
	Caught               int      `json:"caught"`
	Escaped              int      `json:"escaped"`
	UnknownRoomsScouted  int      `json:"unknownRoomsScouted"`
	Outcome              string   `json:"outcome"`
	OperationalScore     int      `json:"operationalScore"`
	Decisions            []string `json:"decisions"`
}

func (s *AIService) EvaluateLocationTactics(stats LocationTacticsStats) (*PursuitAIEvaluation, error) {
	statsJSON, _ := json.Marshal(stats)
	ragDocs := s.rag.Search("building entry tactics armed suspect containment exit cover basement", 4)
	ragContext := s.gemini.buildContext(ragDocs, "")

	userPrompt := fmt.Sprintf(`Briefly evaluate this on-foot location raid. A few sentences total.

Raid statistics JSON:
%s

Optional context:
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

	raw, err := s.generateGameJSON(locationTacticsEvalSystemPrompt, userPrompt)
	if err != nil {
		log.Printf("Location tactics eval AI error: %v", err)
		return fallbackLocationTacticsEvaluation(stats), nil
	}

	var eval PursuitAIEvaluation
	if err := json.Unmarshal([]byte(extractJSON(raw)), &eval); err != nil {
		log.Printf("Location tactics eval parse error: %v", err)
		return fallbackLocationTacticsEvaluation(stats), nil
	}

	eval.Grade = normalizePursuitGrade(eval.Grade)
	if eval.Score <= 0 {
		eval.Score = gradeToScore(eval.Grade)
	}
	if strings.TrimSpace(eval.Summary) == "" {
		return fallbackLocationTacticsEvaluation(stats), nil
	}
	return &eval, nil
}

func fallbackLocationTacticsEvaluation(stats LocationTacticsStats) *PursuitAIEvaluation {
	rate := 0.0
	if stats.TotalPerps > 0 {
		rate = float64(stats.Caught) / float64(stats.TotalPerps)
	}
	grade := "C"
	score := 55
	summary := "Suspects broke out — perimeter collapsed."
	if rate >= 0.75 && stats.PoliceHurt <= 1 {
		grade = "A"
		score = 92
		summary = "Clean site work under armed pressure."
	} else if rate >= 0.4 || stats.Caught >= 2 {
		grade = "B"
		score = 76
		summary = "Partial containment — exits needed tighter cover."
	}

	return &PursuitAIEvaluation{
		Grade:            grade,
		Score:            score,
		Summary:          summary,
		StrategyAnalysis: fmt.Sprintf("Caught %d/%d in %d turns at %s.", stats.Caught, stats.TotalPerps, stats.TurnsUsed, stats.LandmarkName),
		ResourceAnalysis: fmt.Sprintf("%d officers used, %d hurt, %d armed suspects.", stats.TotalPolice, stats.PoliceHurt, stats.ArmedPerps),
		Strengths:        []string{ternary(stats.UnknownRoomsScouted > 0, "Pushed into unknown ground", "Kept a live stack moving")},
		Improvements:     []string{ternary(rate < 0.75, "Cover exits before clearing deep rooms", "Maintain the same exit discipline")},
	}
}

func ternary(cond bool, a, b string) string {
	if cond {
		return a
	}
	return b
}
