package ai

import (
	"strings"
	"testing"
)

func TestBuildFridgeRaidPromptTCMConstraintsNoOfficerRAG(t *testing.T) {
	season := SeasonInfo{Name: "summer", SolarTerm: "大暑"}
	weather := &WeatherSnapshot{Label: "热湿", TempC: 32}
	prompt := BuildFridgeRaidPrompt(FridgeRaidPromptInput{
		Locale:        "en",
		Leftovers:     "watermelon, lamb, tomatoes",
		Plan:          "",
		Season:        season,
		Weather:       weather,
		SeenFromPhoto: nil,
	})
	needles := []string{
		"寒", "热", "温", "凉",
		"酸", "苦", "甘", "辛", "咸",
		"春养肝", "夏养心", "长夏化湿", "秋润肺", "冬温肾",
		"delicious",
		"2–4",
		"two sentences",
		"diagnos",
		"cure",
		"locale",
		"watermelon",
		"大暑",
		"热湿",
	}
	lower := strings.ToLower(prompt)
	for _, n := range needles {
		if !strings.Contains(prompt, n) && !strings.Contains(lower, strings.ToLower(n)) {
			t.Errorf("prompt missing %q", n)
		}
	}
	if !strings.Contains(prompt, "English") && !strings.Contains(lower, "english") {
		t.Error("en locale should instruct English replies")
	}
	banned := []string{
		"Officer Serpico",
		"PRIORITY 1 — Admin knowledge",
		"Admin news digests",
		"Supplemental web search",
		"Olathe Police",
	}
	for _, b := range banned {
		if strings.Contains(prompt, b) {
			t.Errorf("fridge-raid prompt must not inject officer RAG/news: found %q", b)
		}
	}
}

func TestBuildChatPromptUnchangedNoFridgeRaidPrimer(t *testing.T) {
	prompt := BuildChatPrompt("status of the case file?", "chat", nil, nil, "", "")
	if strings.Contains(prompt, "春养肝") || strings.Contains(prompt, "fridge-raid") || strings.Contains(prompt, "翻冰箱") {
		t.Fatal("officer BuildChatPrompt must not contain fridge-raid TCM primer")
	}
	if !strings.Contains(prompt, "Officer Serpico") {
		t.Fatal("officer prompt still expected")
	}
}
