package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

// FridgeRaidCards is the structured advisor payload the kitchen page renders.
type FridgeRaidCards struct {
	Season             string                 `json:"season"`
	SolarTerm          string                 `json:"solarTerm,omitempty"`
	Weather            *FridgeRaidWeather     `json:"weather,omitempty"`
	IngredientsSeen    []string               `json:"ingredientsSeen,omitempty"`
	AskFridgeRaid      bool                   `json:"askFridgeRaid"`
	Nudge              string                 `json:"nudge,omitempty"`
	Suggestions        []FridgeRaidSuggestion `json:"suggestions,omitempty"`
	Disclaimer         string                 `json:"disclaimer"`
	Locale             string                 `json:"locale"`
	WeatherUnavailable bool                   `json:"weatherUnavailable,omitempty"`
}

type FridgeRaidWeather struct {
	Label string  `json:"label"`
	TempC float64 `json:"tempC"`
}

type FridgeRaidSuggestion struct {
	Title      string   `json:"title"`
	TitleAlias string   `json:"titleAlias,omitempty"`
	Hook       string   `json:"hook"`
	Chips      []string `json:"chips,omitempty"`
	TCMNote    string   `json:"tcmNote,omitempty"`
	Uses       []string `json:"uses,omitempty"`
	Need       []string `json:"need,omitempty"`
}

// ParseFridgeRaidCards extracts a card payload from raw model text.
// Essays without JSON return an error so the UI never dumps a story.
func ParseFridgeRaidCards(raw string) (*FridgeRaidCards, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, fmt.Errorf("empty model text: expected json")
	}
	s = extractJSONObject(s)
	if !strings.HasPrefix(strings.TrimSpace(s), "{") {
		return nil, fmt.Errorf("model text is not fridge-raid json")
	}
	var cards FridgeRaidCards
	if err := json.Unmarshal([]byte(s), &cards); err != nil {
		return nil, fmt.Errorf("model text is not fridge-raid json: %w", err)
	}
	if !cards.AskFridgeRaid && len(cards.Suggestions) == 0 {
		return nil, fmt.Errorf("fridge-raid json missing suggestions")
	}
	if len(cards.Suggestions) > 4 {
		cards.Suggestions = cards.Suggestions[:4]
	}
	return &cards, nil
}
