package ai

import (
	"strings"
	"testing"
	"time"
)

func TestBuildLalemDigestPromptEntertainmentFashionDisclaimer(t *testing.T) {
	day := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	prompt := BuildLalemDigestPrompt(LalemDigestPromptInput{Locale: "cn", Now: day})
	needles := []string{
		"娱乐",
		"时尚",
		"disclaimer",
		"diagnos",
		"prescribe",
		"cure",
		"JSON",
		"2026-09-16",
		"imageHint",
	}
	lower := strings.ToLower(prompt)
	for _, n := range needles {
		if !strings.Contains(prompt, n) && !strings.Contains(lower, strings.ToLower(n)) {
			t.Errorf("prompt missing %q", n)
		}
	}
	if !strings.Contains(prompt, "Simplified Chinese") && !strings.Contains(prompt, "简体") {
		t.Error("cn locale should instruct Simplified Chinese replies")
	}
	banned := []string{
		"Officer Serpico",
		"PRIORITY 1 — Admin knowledge",
		"Olathe Police",
		"翻冰箱",
	}
	for _, b := range banned {
		if strings.Contains(prompt, b) {
			t.Errorf("lalem prompt must not inject officer/fridge primer: found %q", b)
		}
	}
}

func TestBuildFridgeRaidPromptUnchangedNoLalemPrimer(t *testing.T) {
	prompt := BuildFridgeRaidPrompt(FridgeRaidPromptInput{
		Locale:    "en",
		Leftovers: "eggs",
		Season:    SeasonInfo{Name: "summer"},
	})
	if strings.Contains(prompt, "拉了么") || strings.Contains(prompt, "lalem") || strings.Contains(prompt, "来都来了") {
		t.Fatal("fridge-raid prompt must not contain 拉了么 primer")
	}
}

func TestBuildChatPromptUnchangedNoLalemPrimer(t *testing.T) {
	prompt := BuildChatPrompt("status of the case file?", "chat", nil, nil, "", "")
	if strings.Contains(prompt, "拉了么") || strings.Contains(prompt, "lalem") || strings.Contains(prompt, "来都来了") {
		t.Fatal("officer BuildChatPrompt must not contain 拉了么 primer")
	}
	if !strings.Contains(prompt, "Officer Serpico") {
		t.Fatal("officer prompt still expected")
	}
}

func TestBuildLalemIncrementPromptTwoTrendsOneUseful(t *testing.T) {
	day := time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC)
	prompt := BuildLalemIncrementPrompt(LalemDigestPromptInput{Locale: "cn", Now: day})
	needles := []string{
		"JSON",
		"exactly two",
		"exactly one",
		"娱乐",
		"时尚",
		"diagnos",
		"prescribe",
		"cure",
		"imageHint",
		"2026-09-16",
		"Simplified Chinese",
	}
	lower := strings.ToLower(prompt)
	for _, n := range needles {
		if !strings.Contains(prompt, n) && !strings.Contains(lower, strings.ToLower(n)) {
			t.Errorf("increment prompt missing %q", n)
		}
	}
	if strings.Contains(prompt, "at most 8 trends") {
		t.Error("increment prompt should not use the seed 8-trend cap")
	}
}

func TestParseLalemIncrementCapsTwoTrendsAndOneUseful(t *testing.T) {
	raw := `{
		"locale":"cn",
		"disclaimer":"不是医疗建议。",
		"trends":[
			{"kind":"entertainment","title":"综艺甲","hook":"一"},
			{"kind":"fashion","title":"口红乙","hook":"二"},
			{"kind":"entertainment","title":"短剧丙","hook":"三"}
		],
		"useful":["别蹲太久","洗手","别用力"]
	}`
	got, err := ParseLalemIncrement(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 2 {
		t.Fatalf("trends=%d want 2", len(got.Trends))
	}
	if got.Trends[0].Title != "综艺甲" || got.Trends[1].Title != "口红乙" {
		t.Fatalf("kept %+v", got.Trends)
	}
	if len(got.Useful) != 1 || got.Useful[0] != "别蹲太久" {
		t.Fatalf("useful %+v want first only", got.Useful)
	}
}

func TestParseLalemDigestCoercesChipsAndUseful(t *testing.T) {
	raw := `{
		"locale":"cn",
		"disclaimer":"不是医疗建议。",
		"trends":[
			{"kind":"entertainment","title":"综艺热","hook":"今晚都在聊。","imageHint":"variety","chips":"热搜, 综艺"},
			{"kind":"fashion","title":"新色号","hook":"妆容换季。","chips":["口红","秀场"]}
		],
		"useful":"别蹲太久, 洗手, 别用力过猛"
	}`
	got, err := ParseLalemDigest(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 2 {
		t.Fatalf("trends=%d", len(got.Trends))
	}
	if got.Trends[0].Kind != "entertainment" || got.Trends[0].Title == "" {
		t.Fatalf("first trend %+v", got.Trends[0])
	}
	if len(got.Trends[0].Chips) < 2 {
		t.Fatalf("chips not coerced: %+v", got.Trends[0].Chips)
	}
	if len(got.Useful) < 3 {
		t.Fatalf("useful not coerced: %+v", got.Useful)
	}
	if got.Disclaimer == "" {
		t.Fatal("disclaimer missing")
	}
}

func TestParseLalemDigestMessyFences(t *testing.T) {
	raw := "Sure:\n```json\n{\"trends\":[{\"kind\":\"entertainment\",\"title\":\"Show\",\"hook\":\"Hot.\"}],\"useful\":[\"Wash hands\"],\"disclaimer\":\"Not medical advice.\"}\n```\n"
	got, err := ParseLalemDigest(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 1 || got.Trends[0].Title != "Show" {
		t.Fatalf("got %+v", got)
	}
	if len(got.Useful) != 1 {
		t.Fatalf("useful %+v", got.Useful)
	}
}
