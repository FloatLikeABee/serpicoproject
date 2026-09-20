package ai

import (
	"strings"
	"testing"
	"time"
)

func TestAdviseKuaixiaosanChatLiveJSON(t *testing.T) {
	adv := &KuaixiaosanAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			low := strings.ToLower(prompt)
			if strings.Contains(low, "funny") || strings.Contains(prompt, "好笑") || strings.Contains(prompt, "便便") {
				t.Errorf("stone chat prompt must stay recovery-focused, got %s", prompt)
			}
			if !strings.Contains(prompt, "feel") && !strings.Contains(prompt, "感觉") && !strings.Contains(low, "recovery") && !strings.Contains(prompt, "恢复") {
				t.Errorf("prompt should mention feelings/recovery, got %s", prompt)
			}
			if strings.Contains(prompt, "Officer Serpico") || strings.Contains(prompt, "翻冰箱") {
				t.Error("stone chat must not inject officer/fridge primer")
			}
			return `{"reply":"Where does it hurt more? Sip water slowly and strain urine. Fever with flank pain means seek emergency care now. This is not a diagnosis."}`, nil
		},
	}
	got, err := adv.AdviseKuaixiaosanChat(KuaixiaosanChatInput{Locale: "en", Message: "my back hurts"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || !strings.Contains(strings.ToLower(got.Reply), "sip") && !strings.Contains(strings.ToLower(got.Reply), "strain") && !strings.Contains(strings.ToLower(got.Reply), "hurt") {
		t.Fatalf("reply %+v", got)
	}
	if companionLooksDiagnostic(got.Reply) {
		t.Fatalf("diagnostic leaked: %s", got.Reply)
	}
}

func TestAdviseKuaixiaosanChatCannedWhenNoCompleteFn(t *testing.T) {
	adv := &KuaixiaosanAdvisor{CompleteFn: nil}
	got, err := adv.AdviseKuaixiaosanChat(KuaixiaosanChatInput{Locale: "cn", Message: "腰好疼"})
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
	if strings.Contains(got.Reply, "交换律") || strings.Contains(got.Reply, "commutative") {
		t.Fatalf("must not reuse 睡了么 canned: %s", got.Reply)
	}
	en, err := adv.AdviseKuaixiaosanChat(KuaixiaosanChatInput{Locale: "en", Message: "my flank hurts"})
	if err != nil || en == nil || strings.TrimSpace(en.Reply) == "" {
		t.Fatalf("en canned %+v %v", en, err)
	}
	if companionHasHan(got.Reply) == companionHasHan(en.Reply) {
		t.Fatalf("cn and en canned should differ: %q vs %q", got.Reply, en.Reply)
	}
}

func TestAdviseKuaixiaosanChatRejectsDiagnosis(t *testing.T) {
	adv := &KuaixiaosanAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(prompt, "you have") || !strings.Contains(prompt, "你患有") {
				t.Errorf("prompt should forbid diagnosis phrases, got %s", prompt)
			}
			return `{"reply":"you have kidney stones and 你患有肾结石"}`, nil
		},
	}
	got, err := adv.AdviseKuaixiaosanChat(KuaixiaosanChatInput{Locale: "en", Message: "do I have stones?"})
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

func TestCannedKuaixiaosanChatBankIsRecoveryAndLongEnough(t *testing.T) {
	for _, loc := range []string{"cn", "en"} {
		lines := cannedKuaixiaosanChatLines(loc)
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
			if strings.Contains(line, "交换律") || strings.Contains(strings.ToLower(line), "commutative") {
				t.Fatalf("%s reused 睡了么 copy: %s", loc, line)
			}
			if !kuaixiaosanChatSoundsRecovery(line) {
				t.Fatalf("%s canned must ask a feeling or name a recovery step: %s", loc, line)
			}
		}
	}
}

func TestBuildKuaixiaosanChatPromptIsFeelingThenRecovery(t *testing.T) {
	day := time.Date(2026, 9, 20, 12, 0, 0, 0, time.UTC)
	prompt := BuildKuaixiaosanChatPrompt(KuaixiaosanChatPromptInput{
		Locale:  "en",
		Now:     day,
		Message: "status of the case file?",
		History: []KuaixiaosanChatTurn{{Role: "user", Text: "hi"}, {Role: "assistant", Text: "Where does it hurt?"}},
	})
	needles := []string{"you have", "你患有", "JSON", "2026-09-20", "status of the case file?"}
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
		t.Fatal("stone prompt must not ask for funny poop")
	}
	if !strings.Contains(lower, "recover") && !strings.Contains(prompt, "恢复") {
		t.Fatal("stone prompt must mention recovery")
	}
}

func kuaixiaosanChatSoundsRecovery(line string) bool {
	low := strings.ToLower(line)
	needles := []string{
		"疼", "痛", "fever", "热", "尿", "urine", "喝水", "sip", "fluid", "滤过", "strain",
		"休息", "rest", "急诊", "emergency", "feel", "感觉", "where", "哪里",
	}
	for _, n := range needles {
		if strings.Contains(low, n) || strings.Contains(line, n) {
			return true
		}
	}
	return false
}
