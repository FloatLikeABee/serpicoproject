package ai

import (
	"strings"
	"testing"
)

func TestParseFridgeRaidCardsCleanJSON(t *testing.T) {
	raw := `{
		"season": "summer",
		"solarTerm": "大暑",
		"weather": {"label": "热", "tempC": 32},
		"ingredientsSeen": ["tomato", "egg"],
		"askFridgeRaid": false,
		"suggestions": [
			{
				"title": "Tomato egg stir-fry",
				"titleAlias": "番茄炒蛋",
				"hook": "Sweet-tart tomatoes hugging silky eggs.",
				"chips": ["开胃", "15 min"],
				"tcmNote": "Tomato is cooling in summer heat.",
				"uses": ["tomato", "egg"],
				"need": ["scallion"]
			},
			{
				"title": "Cold tomato salad",
				"hook": "Juicy, salty-sweet crunch.",
				"chips": ["清热"],
				"tcmNote": "Raw tomato clears summer heat.",
				"uses": ["tomato"]
			}
		],
		"disclaimer": "Culinary wellness, not medical advice.",
		"locale": "en"
	}`
	got, err := ParseFridgeRaidCards(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got.Season != "summer" || got.SolarTerm != "大暑" {
		t.Fatalf("season=%q term=%q", got.Season, got.SolarTerm)
	}
	if got.Weather == nil || got.Weather.Label != "热" || got.Weather.TempC != 32 {
		t.Fatalf("weather=%+v", got.Weather)
	}
	if len(got.IngredientsSeen) != 2 || len(got.Suggestions) != 2 {
		t.Fatalf("ingredients=%v suggestions=%d", got.IngredientsSeen, len(got.Suggestions))
	}
	if got.Suggestions[0].Title != "Tomato egg stir-fry" || got.Suggestions[0].Hook == "" {
		t.Fatalf("first card=%+v", got.Suggestions[0])
	}
	if got.Locale != "en" || got.Disclaimer == "" {
		t.Fatalf("locale/disclaimer missing: %+v", got)
	}
}

func TestParseFridgeRaidCardsMessyFences(t *testing.T) {
	raw := "Sure, here you go:\n```json\n{\"season\":\"autumn\",\"suggestions\":[{\"title\":\"Pear soup\",\"hook\":\"Warm honeyed pear.\",\"tcmNote\":\"Pears moisten the lung.\"}],\"locale\":\"en\",\"disclaimer\":\"Not medical advice.\"}\n```\nEnjoy!"
	got, err := ParseFridgeRaidCards(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got.Season != "autumn" || len(got.Suggestions) != 1 {
		t.Fatalf("got %+v", got)
	}
	if got.Suggestions[0].Title != "Pear soup" {
		t.Fatalf("title %q", got.Suggestions[0].Title)
	}
}

func TestParseFridgeRaidCardsIngredientsSeenString(t *testing.T) {
	raw := `{
		"season": "lateSummer",
		"ingredientsSeen": "eggs, tomatoes",
		"askFridgeRaid": false,
		"suggestions": [
			{"title": "Tomato egg", "hook": "Silky eggs, tart tomato."}
		],
		"disclaimer": "Culinary wellness, not medical advice.",
		"locale": "en"
	}`
	got, err := ParseFridgeRaidCards(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.IngredientsSeen) != 2 || got.IngredientsSeen[0] != "eggs" || got.IngredientsSeen[1] != "tomatoes" {
		t.Fatalf("ingredientsSeen=%v", got.IngredientsSeen)
	}
}

func TestParseFridgeRaidCardsLooseModelTypes(t *testing.T) {
	raw := `{
		"season": "lateSummer",
		"weather": {"label": "hot", "tempC": "32"},
		"ingredientsSeen": "eggs, tomatoes",
		"askFridgeRaid": "false",
		"suggestions": [
			{
				"title": "Tomato egg",
				"hook": "Silky eggs, tart tomato.",
				"chips": "开胃, 15 min",
				"uses": "tomato, egg",
				"need": "scallion"
			}
		],
		"disclaimer": "Culinary wellness, not medical advice.",
		"locale": "en"
	}`
	got, err := ParseFridgeRaidCards(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got.AskFridgeRaid {
		t.Fatal("askFridgeRaid string false should be false")
	}
	if got.Weather == nil || got.Weather.TempC != 32 {
		t.Fatalf("weather=%+v", got.Weather)
	}
	if len(got.IngredientsSeen) != 2 {
		t.Fatalf("ingredientsSeen=%v", got.IngredientsSeen)
	}
	s0 := got.Suggestions[0]
	if len(s0.Chips) != 2 || s0.Chips[0] != "开胃" || s0.Chips[1] != "15 min" {
		t.Fatalf("chips=%v", s0.Chips)
	}
	if len(s0.Uses) != 2 || s0.Need[0] != "scallion" {
		t.Fatalf("uses=%v need=%v", s0.Uses, s0.Need)
	}
}

func TestParseFridgeRaidCardsProseWithoutJSONErrors(t *testing.T) {
	_, err := ParseFridgeRaidCards("Once upon a time in a kitchen far away, let me tell you a long story about soup and the Yellow Emperor.")
	if err == nil {
		t.Fatal("expected error for essay with no JSON")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "json") {
		t.Fatalf("error should mention json, got %v", err)
	}
}
