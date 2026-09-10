package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

// FridgeRaidDishDetail is the structured payload the kitchen modal renders.
type FridgeRaidDishDetail struct {
	Title      string               `json:"title"`
	TitleAlias string               `json:"titleAlias,omitempty"`
	Steps      []string             `json:"steps"`
	TasteNote  string               `json:"tasteNote,omitempty"`
	TCM        *FridgeRaidDetailTCM `json:"tcm,omitempty"`
	Disclaimer string               `json:"disclaimer"`
	Locale     string               `json:"locale"`
}

type FridgeRaidDetailTCM struct {
	Nature  string   `json:"nature,omitempty"`
	Flavors []string `json:"flavors,omitempty"`
	GoodFor []string `json:"goodFor,omitempty"`
	Caution []string `json:"caution,omitempty"`
}

func ParseFridgeRaidDetail(raw string) (*FridgeRaidDishDetail, error) {
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
	detail := FridgeRaidDishDetail{
		Title:      jsonString(top["title"]),
		TitleAlias: jsonString(top["titleAlias"]),
		Steps:      capStringList(parseStringList(top["steps"]), 8),
		TasteNote:  jsonString(top["tasteNote"]),
		TCM:        parseDetailTCM(top["tcm"]),
		Disclaimer: jsonString(top["disclaimer"]),
		Locale:     jsonString(top["locale"]),
	}
	if detail.Title == "" || len(detail.Steps) == 0 {
		return nil, fmt.Errorf("fridge-raid detail json missing title or steps")
	}
	return &detail, nil
}

func parseDetailTCM(raw json.RawMessage) *FridgeRaidDetailTCM {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var m map[string]json.RawMessage
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	tcm := &FridgeRaidDetailTCM{
		Nature:  jsonString(m["nature"]),
		Flavors: capStringList(parseStringList(m["flavors"]), 6),
		GoodFor: capStringList(parseStringList(m["goodFor"]), 6),
		Caution: capStringList(parseStringList(m["caution"]), 6),
	}
	if tcm.Nature == "" && len(tcm.Flavors) == 0 && len(tcm.GoodFor) == 0 && len(tcm.Caution) == 0 {
		return nil
	}
	return tcm
}

func capStringList(in []string, n int) []string {
	if len(in) > n {
		return in[:n]
	}
	return in
}
