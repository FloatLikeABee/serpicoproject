package ai

import (
	"encoding/json"
	"fmt"
	"strconv"
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
	var top map[string]json.RawMessage
	if err := json.Unmarshal([]byte(s), &top); err != nil {
		return nil, fmt.Errorf("model text is not fridge-raid json: %w", err)
	}
	cards := FridgeRaidCards{
		Season:             jsonString(top["season"]),
		SolarTerm:          jsonString(top["solarTerm"]),
		Weather:            parseWeather(top["weather"]),
		IngredientsSeen:    parseStringList(top["ingredientsSeen"]),
		AskFridgeRaid:      parseBool(top["askFridgeRaid"]),
		Nudge:              jsonString(top["nudge"]),
		Suggestions:        parseSuggestions(top["suggestions"]),
		Disclaimer:         jsonString(top["disclaimer"]),
		Locale:             jsonString(top["locale"]),
		WeatherUnavailable: parseBool(top["weatherUnavailable"]),
	}
	if !cards.AskFridgeRaid && len(cards.Suggestions) == 0 {
		return nil, fmt.Errorf("fridge-raid json missing suggestions")
	}
	if len(cards.Suggestions) > 4 {
		cards.Suggestions = cards.Suggestions[:4]
	}
	return &cards, nil
}

func jsonString(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err == nil {
		return s
	}
	return strings.Trim(strings.TrimSpace(string(raw)), `"`)
}

func parseBool(raw json.RawMessage) bool {
	if len(raw) == 0 || string(raw) == "null" {
		return false
	}
	var b bool
	if err := json.Unmarshal(raw, &b); err == nil {
		return b
	}
	var n float64
	if err := json.Unmarshal(raw, &n); err == nil {
		return n != 0
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "true", "1", "yes":
		return true
	default:
		return false
	}
}

func parseFloat(raw json.RawMessage) float64 {
	if len(raw) == 0 || string(raw) == "null" {
		return 0
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return f
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return 0
	}
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	return f
}

func parseWeather(raw json.RawMessage) *FridgeRaidWeather {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	w := &FridgeRaidWeather{
		Label: jsonString(m["label"]),
		TempC: parseFloat(m["tempC"]),
	}
	if w.Label == "" && w.TempC == 0 {
		return nil
	}
	return w
}

func parseSuggestions(raw json.RawMessage) []FridgeRaidSuggestion {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var arr []json.RawMessage
	if err := json.Unmarshal(raw, &arr); err != nil {
		return nil
	}
	out := make([]FridgeRaidSuggestion, 0, len(arr))
	for _, item := range arr {
		var m map[string]json.RawMessage
		if err := json.Unmarshal(item, &m); err != nil {
			continue
		}
		sug := FridgeRaidSuggestion{
			Title:      jsonString(m["title"]),
			TitleAlias: jsonString(m["titleAlias"]),
			Hook:       jsonString(m["hook"]),
			Chips:      parseStringList(m["chips"]),
			TCMNote:    jsonString(m["tcmNote"]),
			Uses:       parseStringList(m["uses"]),
			Need:       parseStringList(m["need"]),
		}
		if sug.Title == "" && sug.Hook == "" {
			continue
		}
		out = append(out, sug)
	}
	return out
}

func parseStringList(raw json.RawMessage) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		return arr
	}
	var one string
	if err := json.Unmarshal(raw, &one); err != nil {
		return nil
	}
	one = strings.TrimSpace(one)
	if one == "" {
		return nil
	}
	if !strings.Contains(one, ",") {
		return []string{one}
	}
	parts := strings.Split(one, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
