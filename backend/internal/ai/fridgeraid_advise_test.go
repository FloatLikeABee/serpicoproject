package ai

import (
	"errors"
	"strings"
	"testing"
	"time"
)

func sampleCardsJSON(titles ...string) string {
	var b strings.Builder
	b.WriteString(`{"season":"summer","disclaimer":"Culinary TCM-inspired ideas, not medical advice.","locale":"en","suggestions":[`)
	for i, title := range titles {
		if i > 0 {
			b.WriteString(",")
		}
		b.WriteString(`{"title":"` + title + `","hook":"Bright savory aroma.","chips":["开胃"],"tcmNote":"Fits the season.","uses":["chicken"]}`)
	}
	b.WriteString(`]}`)
	return b.String()
}

func TestAdviseLeftoversReturnsTwoToFourSuggestions(t *testing.T) {
	adv := &FridgeRaidAdvisor{
		Now: time.Date(2026, 7, 15, 12, 0, 0, 0, time.UTC),
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(prompt, "eggs") {
				t.Errorf("prompt should include leftovers, got %s", prompt)
			}
			return sampleCardsJSON("Tomato eggs", "Egg drop", "Chilled tomato"), nil
		},
	}
	got, err := adv.Advise(FridgeRaidAdviseInput{Locale: "en", Leftovers: "eggs, tomatoes"})
	if err != nil {
		t.Fatal(err)
	}
	n := len(got.Suggestions)
	if n < 2 || n > 4 {
		t.Fatalf("suggestions=%d", n)
	}
	if got.AskFridgeRaid {
		t.Fatal("should not ask fridge raid when leftovers were given")
	}
}

func TestAdvisePlanPlusChickenGingerIsSoupLike(t *testing.T) {
	adv := &FridgeRaidAdvisor{
		Now: time.Date(2026, 1, 10, 12, 0, 0, 0, time.UTC),
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(strings.ToLower(prompt), "soup") {
				t.Errorf("plan missing from prompt")
			}
			if !strings.Contains(strings.ToLower(prompt), "chicken") || !strings.Contains(strings.ToLower(prompt), "ginger") {
				t.Errorf("leftovers missing from prompt")
			}
			return sampleCardsJSON("Ginger chicken soup", "Chicken ginger broth"), nil
		},
	}
	got, err := adv.Advise(FridgeRaidAdviseInput{
		Locale:    "en",
		Leftovers: "chicken, ginger",
		Plan:      "I want soup",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Suggestions) < 2 {
		t.Fatal("expected soup suggestions")
	}
	for _, s := range got.Suggestions {
		if !strings.Contains(strings.ToLower(s.Title), "soup") && !strings.Contains(strings.ToLower(s.Title), "broth") {
			t.Fatalf("title %q is not soup-like", s.Title)
		}
	}
}

func TestAdviseImageOnlyVisionDownAsksFridgeRaid(t *testing.T) {
	calledComplete := false
	adv := &FridgeRaidAdvisor{
		Now: time.Date(2026, 7, 15, 12, 0, 0, 0, time.UTC),
		VisionFn: func(image []byte, mime string) (string, error) {
			return "", errors.New("vision down")
		},
		CompleteFn: func(prompt string) (string, error) {
			calledComplete = true
			return sampleCardsJSON("Invented lamb feast", "Secret fridge haul", "Mystery stew"), nil
		},
	}
	got, err := adv.Advise(FridgeRaidAdviseInput{
		Locale:    "en",
		Image:     []byte("pretend-jpeg"),
		ImageMIME: "image/jpeg",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !got.AskFridgeRaid {
		t.Fatal("expected askFridgeRaid when vision fails and no leftovers")
	}
	if calledComplete {
		t.Fatal("must not call text model to invent a fridge inventory")
	}
	if len(got.Suggestions) != 0 {
		t.Fatalf("must not invent suggestions, got %+v", got.Suggestions)
	}
	if got.Nudge == "" {
		t.Fatal("expected a short nudge to type what is in the fridge")
	}
}

func TestAdviseFridgeRaidDetailReturnsStepsAndGoodFor(t *testing.T) {
	visionCalls := 0
	adv := &FridgeRaidAdvisor{
		VisionFn: func(image []byte, mime string) (string, error) {
			visionCalls++
			return "should-not-run", nil
		},
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(prompt, "Tomato egg stir-fry") {
				t.Errorf("prompt missing dish, got %s", prompt)
			}
			return `{
				"title":"Tomato egg stir-fry",
				"steps":["Heat wok","Scramble eggs","Add tomatoes"],
				"tasteNote":"Sweet-tart and silky.",
				"tcm":{"nature":"cool","goodFor":["summer heat","appetite"]},
				"disclaimer":"Culinary TCM-inspired ideas, not medical advice.",
				"locale":"en"
			}`, nil
		},
	}
	got, err := adv.AdviseFridgeRaidDetail(FridgeRaidDetailInput{
		Locale: "en",
		Suggestion: FridgeRaidSuggestion{
			Title: "Tomato egg stir-fry",
			Hook:  "Sweet-tart.",
			Uses:  []string{"tomato", "egg"},
		},
		Season: SeasonInfo{Name: "summer"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if visionCalls != 0 {
		t.Fatal("detail path must not call vision")
	}
	if len(got.Steps) < 2 || got.TCM == nil || len(got.TCM.GoodFor) == 0 {
		t.Fatalf("got %+v", got)
	}
}

func TestAdviseFridgeRaidDetailMissingLiveModelDoesNotCallVision(t *testing.T) {
	visionCalls := 0
	adv := &FridgeRaidAdvisor{
		VisionFn: func(image []byte, mime string) (string, error) {
			visionCalls++
			return "eggs", nil
		},
	}
	_, err := adv.AdviseFridgeRaidDetail(FridgeRaidDetailInput{
		Locale:     "en",
		Suggestion: FridgeRaidSuggestion{Title: "Tomato egg stir-fry"},
	})
	if err == nil {
		t.Fatal("expected error when live model is missing")
	}
	if visionCalls != 0 {
		t.Fatal("missing live model must not call vision")
	}
}
