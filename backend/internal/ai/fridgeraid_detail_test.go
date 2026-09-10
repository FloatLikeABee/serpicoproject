package ai

import (
	"strings"
	"testing"
)

func TestParseFridgeRaidDetailCleanJSON(t *testing.T) {
	raw := `{
		"title": "Tomato egg stir-fry",
		"titleAlias": "番茄炒蛋",
		"steps": ["Heat wok", "Scramble eggs", "Add tomatoes", "Season and serve"],
		"tasteNote": "Sweet-tart tomatoes hugging silky eggs.",
		"tcm": {
			"nature": "cool",
			"flavors": ["sour", "sweet"],
			"goodFor": ["summer heat", "waking appetite"],
			"caution": ["skip icy leftovers if the day is already cold"]
		},
		"disclaimer": "Culinary TCM-inspired ideas, not medical advice.",
		"locale": "en"
	}`
	got, err := ParseFridgeRaidDetail(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Tomato egg stir-fry" || len(got.Steps) != 4 {
		t.Fatalf("title/steps=%q %v", got.Title, got.Steps)
	}
	if got.TCM == nil || got.TCM.Nature != "cool" || len(got.TCM.GoodFor) != 2 {
		t.Fatalf("tcm=%+v", got.TCM)
	}
	if got.Disclaimer == "" || got.Locale != "en" {
		t.Fatalf("disclaimer/locale missing: %+v", got)
	}
}

func TestParseFridgeRaidDetailFencedAndStringLists(t *testing.T) {
	raw := "Sure:\n```json\n{\"title\":\"Pear soup\",\"steps\":\"simmer pears, add honey\",\"tasteNote\":\"Warm honeyed pear.\",\"tcm\":{\"goodFor\":\"moisten autumn dryness\"},\"locale\":\"en\",\"disclaimer\":\"Not medical advice.\"}\n```\n"
	got, err := ParseFridgeRaidDetail(raw)
	if err != nil {
		t.Fatal(err)
	}
	if got.Title != "Pear soup" {
		t.Fatalf("title %q", got.Title)
	}
	if len(got.Steps) != 2 || got.Steps[0] != "simmer pears" {
		t.Fatalf("steps=%v", got.Steps)
	}
	if got.TCM == nil || len(got.TCM.GoodFor) != 1 {
		t.Fatalf("goodFor=%v", got.TCM)
	}
}

func TestParseFridgeRaidDetailProseWithoutJSONErrors(t *testing.T) {
	_, err := ParseFridgeRaidDetail("Once upon a time a long medical lecture about curing disease with soup.")
	if err == nil {
		t.Fatal("expected error for essay with no JSON")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "json") {
		t.Fatalf("error should mention json, got %v", err)
	}
}
