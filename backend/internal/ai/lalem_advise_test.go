package ai

import (
	"strings"
	"testing"
	"time"
)

func sampleLalemJSON() string {
	return `{
		"locale":"cn",
		"disclaimer":"卫生间小贴士，不能替代医疗诊断或治疗。",
		"trends":[
			{"kind":"entertainment","title":"综艺夜","hook":"今晚热聊。","imageHint":"variety","chips":["热搜"]},
			{"kind":"fashion","title":"新色号","hook":"妆容换季。","imageHint":"lipstick","chips":["口红"]},
			{"kind":"entertainment","title":"短剧","hook":"通勤都在刷。","imageHint":"drama"}
		],
		"useful":["别蹲太久","洗手到泡沫","别用力过猛"]
	}`
}

func TestAdviseLalemDigestStubbedCompleteMapsLocalMedia(t *testing.T) {
	visionCalls := 0
	adv := &LalemAdvisor{
		Now: time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC),
		VisionFn: func(image []byte, mime string) (string, error) {
			visionCalls++
			return "should-not-run", nil
		},
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(prompt, "娱乐") || !strings.Contains(prompt, "2026-09-16") {
				t.Errorf("prompt missing digest needles, got %s", prompt)
			}
			return sampleLalemJSON(), nil
		},
	}
	got, err := adv.AdviseLalemDigest(LalemDigestInput{Locale: "cn"})
	if err != nil {
		t.Fatal(err)
	}
	if visionCalls != 0 {
		t.Fatal("digest path must not call vision")
	}
	if got.Locale != "cn" || got.Disclaimer == "" {
		t.Fatalf("locale/disclaimer %+v", got)
	}
	if len(got.Trends) < 2 {
		t.Fatalf("trends=%d", len(got.Trends))
	}
	entFashion := 0
	for _, tr := range got.Trends {
		if tr.ImageURL == "" || strings.HasPrefix(tr.ImageURL, "http") || !strings.HasPrefix(tr.ImageURL, "/lalem/trends/") {
			t.Fatalf("trend image must be local pack: %+v", tr)
		}
		if tr.Kind == "entertainment" || tr.Kind == "fashion" {
			entFashion++
		}
	}
	if entFashion*10 < len(got.Trends)*7 {
		t.Fatalf("entertainment/fashion ratio too low: %d/%d", entFashion, len(got.Trends))
	}
	if len(got.Videos) != 0 {
		t.Fatalf("digest must not ship playable videos %+v", got.Videos)
	}
	if len(got.Useful) == 0 {
		t.Fatal("expected useful notes")
	}
}

func TestAdviseLalemDigestMissingLiveModelDoesNotCallVision(t *testing.T) {
	visionCalls := 0
	completeCalls := 0
	adv := &LalemAdvisor{
		VisionFn: func(image []byte, mime string) (string, error) {
			visionCalls++
			return "nope", nil
		},
		CompleteFn: nil,
	}
	got, err := adv.AdviseLalemDigest(LalemDigestInput{Locale: "cn"})
	if err != nil {
		t.Fatal(err)
	}
	if visionCalls != 0 {
		t.Fatal("missing live model must not call vision")
	}
	if completeCalls != 0 {
		t.Fatal("missing complete must not be invoked")
	}
	if len(got.Videos) != 0 {
		t.Fatalf("canned digest must not ship videos %+v", got.Videos)
	}
	if len(got.Trends) == 0 || got.Disclaimer == "" {
		t.Fatalf("canned digest incomplete %+v", got)
	}
	for _, tr := range got.Trends {
		if !strings.HasPrefix(tr.ImageURL, "/lalem/trends/") {
			t.Fatalf("canned image %+v", tr)
		}
	}
	if got.Locale != "cn" {
		t.Fatalf("locale %s", got.Locale)
	}
}

func TestAdviseLalemDigestModelFailureReturnsCannedMedia(t *testing.T) {
	adv := &LalemAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			return "", errLalemDown
		},
	}
	got, err := adv.AdviseLalemDigest(LalemDigestInput{Locale: "en"})
	if err != nil {
		t.Fatal(err)
	}
	if got.Locale != "en" {
		t.Fatalf("locale %s", got.Locale)
	}
	if len(got.Videos) != 0 || len(got.Trends) == 0 {
		t.Fatalf("expected canned en digest without videos %+v", got)
	}
}

func TestAdviseLalemIncrementStubbedMapsLocalMediaTwoPlusOne(t *testing.T) {
	visionCalls := 0
	adv := &LalemAdvisor{
		Now: time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC),
		VisionFn: func(image []byte, mime string) (string, error) {
			visionCalls++
			return "should-not-run", nil
		},
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(prompt, "exactly two") || !strings.Contains(prompt, "exactly one") {
				t.Errorf("increment prompt missing caps, got %s", prompt)
			}
			if strings.Contains(prompt, "at most 8 trends") {
				t.Error("increment must not use seed cap")
			}
			return `{
				"locale":"cn",
				"disclaimer":"卫生间小贴士，不能替代医疗诊断或治疗。",
				"trends":[
					{"kind":"entertainment","title":"新综艺","hook":"弹幕热闹。","imageHint":"variety"},
					{"kind":"fashion","title":"新色号","hook":"换季口红。","imageHint":"lipstick"},
					{"kind":"entertainment","title":"不该留下","hook":"第三张。","imageHint":"drama"}
				],
				"useful":["别蹲太久","洗手"]
			}`, nil
		},
	}
	got, err := adv.AdviseLalemDigest(LalemDigestInput{Locale: "cn", Mode: "increment"})
	if err != nil {
		t.Fatal(err)
	}
	if visionCalls != 0 {
		t.Fatal("increment path must not call vision")
	}
	if len(got.Trends) != 2 {
		t.Fatalf("trends=%d want 2", len(got.Trends))
	}
	for _, tr := range got.Trends {
		if !strings.HasPrefix(tr.ImageURL, "/lalem/trends/") {
			t.Fatalf("trend image must be local pack: %+v", tr)
		}
	}
	if len(got.Useful) != 1 {
		t.Fatalf("useful=%d want 1", len(got.Useful))
	}
}

func TestAdviseLalemIncrementMissingLiveModelDoesNotCallVision(t *testing.T) {
	visionCalls := 0
	adv := &LalemAdvisor{
		VisionFn: func(image []byte, mime string) (string, error) {
			visionCalls++
			return "nope", nil
		},
		CompleteFn: nil,
	}
	got, err := adv.AdviseLalemDigest(LalemDigestInput{Locale: "en", Mode: "increment"})
	if err != nil {
		t.Fatal(err)
	}
	if visionCalls != 0 {
		t.Fatal("missing live model must not call vision")
	}
	if len(got.Trends) != 2 {
		t.Fatalf("canned increment trends=%d want 2", len(got.Trends))
	}
	if len(got.Useful) != 1 {
		t.Fatalf("canned increment useful=%d want 1", len(got.Useful))
	}
	for _, tr := range got.Trends {
		if !strings.HasPrefix(tr.ImageURL, "/lalem/trends/") {
			t.Fatalf("canned image %+v", tr)
		}
	}
}

func TestAdviseLalemCompanionCannedWhenNoCompleteFn(t *testing.T) {
	adv := &LalemAdvisor{CompleteFn: nil}
	got, err := adv.AdviseLalemCompanion(LalemCompanionInput{Locale: "cn"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || strings.TrimSpace(got.Text) == "" {
		t.Fatalf("expected canned companion %+v", got)
	}
	if !companionAngleOK(got.Angle) {
		t.Fatalf("angle %q", got.Angle)
	}
	if companionLooksDiagnostic(got.Text) {
		t.Fatalf("canned must not diagnose: %s", got.Text)
	}
	en, err := adv.AdviseLalemCompanion(LalemCompanionInput{Locale: "en"})
	if err != nil || en == nil || strings.TrimSpace(en.Text) == "" {
		t.Fatalf("en canned %+v %v", en, err)
	}
	if companionHasHan(got.Text) == companionHasHan(en.Text) {
		t.Fatalf("cn and en canned should differ: %q vs %q", got.Text, en.Text)
	}
}

func TestAdviseLalemCompanionRejectsDiagnosis(t *testing.T) {
	adv := &LalemAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			if !strings.Contains(strings.ToLower(prompt), "cute") && !strings.Contains(prompt, "可爱") {
				t.Errorf("companion prompt should ask for cute tone, got %s", prompt)
			}
			return `{"text":"you have IBS and 你患有便秘","angle":"medical"}`, nil
		},
	}
	got, err := adv.AdviseLalemCompanion(LalemCompanionInput{Locale: "en"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || strings.TrimSpace(got.Text) == "" {
		t.Fatal("expected fallback line")
	}
	if companionLooksDiagnostic(got.Text) {
		t.Fatalf("diagnostic leaked: %s", got.Text)
	}
}

func TestCannedLalemCompanionBankCoversFourAngles(t *testing.T) {
	for _, loc := range []string{"cn", "en"} {
		lines := cannedLalemCompanionLines(loc)
		if len(lines) < 8 {
			t.Fatalf("%s canned=%d want >=8", loc, len(lines))
		}
		seen := map[string]int{}
		for _, line := range lines {
			if strings.TrimSpace(line.Text) == "" {
				t.Fatalf("%s empty canned line", loc)
			}
			if companionLooksDiagnostic(line.Text) {
				t.Fatalf("%s diagnostic canned %q", loc, line.Text)
			}
			if !companionAngleOK(line.Angle) {
				t.Fatalf("%s angle %q", loc, line.Angle)
			}
			seen[line.Angle]++
		}
		for _, angle := range []string{"medical", "biological", "social", "historical"} {
			if seen[angle] == 0 {
				t.Fatalf("%s missing angle %s", loc, angle)
			}
		}
	}
}

func companionAngleOK(angle string) bool {
	switch angle {
	case "medical", "biological", "social", "historical":
		return true
	default:
		return false
	}
}

func companionLooksDiagnostic(s string) bool {
	low := strings.ToLower(s)
	return strings.Contains(low, "you have") || strings.Contains(s, "你患有")
}

func companionHasHan(s string) bool {
	for _, r := range s {
		if r >= 0x4e00 && r <= 0x9fff {
			return true
		}
	}
	return false
}

var errLalemDown = errString("model down")

type errString string

func (e errString) Error() string { return string(e) }
