package ai

import (
	"strings"
	"testing"
	"time"
)

func TestAdviseShuilemeChatLiveJSON(t *testing.T) {
	adv := &ShuilemeAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			low := strings.ToLower(prompt)
			if strings.Contains(low, "funny") || strings.Contains(prompt, "好笑") || strings.Contains(prompt, "便便") {
				t.Errorf("sleep chat prompt must stay dry, got %s", prompt)
			}
			if !strings.Contains(low, "law") && !strings.Contains(prompt, "法律") && !strings.Contains(low, "math") && !strings.Contains(prompt, "数学") {
				t.Errorf("prompt should mention law/science/math, got %s", prompt)
			}
			if strings.Contains(prompt, "Officer Serpico") || strings.Contains(prompt, "翻冰箱") {
				t.Error("sleep chat must not inject officer/fridge primer")
			}
			return `{"reply":"Addition is commutative. One plus two equals two plus one. Short sentences help. This is not a diagnosis."}`, nil
		},
	}
	got, err := adv.AdviseShuilemeChat(ShuilemeChatInput{Locale: "en", Message: "tell me some math"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || !strings.Contains(strings.ToLower(got.Reply), "commutative") {
		t.Fatalf("reply %+v", got)
	}
	if companionLooksDiagnostic(got.Reply) {
		t.Fatalf("diagnostic leaked: %s", got.Reply)
	}
}

func TestAdviseShuilemeChatCannedWhenNoCompleteFn(t *testing.T) {
	adv := &ShuilemeAdvisor{CompleteFn: nil}
	got, err := adv.AdviseShuilemeChat(ShuilemeChatInput{Locale: "cn", Message: "讲一点数学"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || strings.TrimSpace(got.Reply) == "" {
		t.Fatalf("expected canned chat %+v", got)
	}
	if companionLooksDiagnostic(got.Reply) {
		t.Fatalf("canned must not diagnose: %s", got.Reply)
	}
	if strings.Contains(got.Reply, "便便科普") {
		t.Fatalf("must not reuse 拉了么 canned: %s", got.Reply)
	}
	en, err := adv.AdviseShuilemeChat(ShuilemeChatInput{Locale: "en", Message: "some math please"})
	if err != nil || en == nil || strings.TrimSpace(en.Reply) == "" {
		t.Fatalf("en canned %+v %v", en, err)
	}
	if companionHasHan(got.Reply) == companionHasHan(en.Reply) {
		t.Fatalf("cn and en canned should differ: %q vs %q", got.Reply, en.Reply)
	}
}

func TestAdviseShuilemeChatRejectsDiagnosis(t *testing.T) {
	adv := &ShuilemeAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(prompt, "you have") || !strings.Contains(prompt, "你患有") {
				t.Errorf("prompt should forbid diagnosis phrases, got %s", prompt)
			}
			return `{"reply":"you have insomnia and 你患有失眠"}`, nil
		},
	}
	got, err := adv.AdviseShuilemeChat(ShuilemeChatInput{Locale: "en", Message: "do I have insomnia?"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || strings.TrimSpace(got.Reply) == "" {
		t.Fatal("expected fallback reply")
	}
	if companionLooksDiagnostic(got.Reply) {
		t.Fatalf("diagnostic leaked: %s", got.Reply)
	}
}

func TestCannedShuilemeChatBankIsDryAndLongEnough(t *testing.T) {
	for _, loc := range []string{"cn", "en"} {
		lines := cannedShuilemeChatLines(loc)
		if len(lines) < 8 {
			t.Fatalf("%s canned=%d want >=8", loc, len(lines))
		}
		for _, line := range lines {
			if strings.TrimSpace(line) == "" {
				t.Fatalf("%s empty canned line", loc)
			}
			if companionLooksDiagnostic(line) {
				t.Fatalf("%s diagnostic canned: %s", loc, line)
			}
			if strings.Contains(line, "便便科普") || strings.Contains(strings.ToLower(line), "funny poop") {
				t.Fatalf("%s reused 拉了么 copy: %s", loc, line)
			}
		}
	}
}

func TestBuildShuilemeChatPromptIsDryLecture(t *testing.T) {
	day := time.Date(2026, 9, 18, 12, 0, 0, 0, time.UTC)
	prompt := BuildShuilemeChatPrompt(ShuilemeChatPromptInput{
		Locale:  "en",
		Now:     day,
		Message: "status of the case file?",
		History: []ShuilemeChatTurn{{Role: "user", Text: "hi"}, {Role: "assistant", Text: "one plus one is two."}},
	})
	needles := []string{"you have", "你患有", "JSON", "2026-09-18", "status of the case file?"}
	lower := strings.ToLower(prompt)
	for _, n := range needles {
		if !strings.Contains(prompt, n) && !strings.Contains(lower, strings.ToLower(n)) {
			t.Errorf("chat prompt missing %q", n)
		}
	}
	if strings.Contains(prompt, "Officer Serpico") || strings.Contains(prompt, "翻冰箱") {
		t.Fatal("chat prompt must not inject officer/fridge primer")
	}
	if strings.Contains(lower, "funny poop") {
		t.Fatal("sleep prompt must not ask for funny poop")
	}
}
