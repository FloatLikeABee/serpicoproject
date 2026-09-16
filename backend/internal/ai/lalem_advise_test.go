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
	if len(got.Videos) < 1 {
		t.Fatal("expected curated videos")
	}
	for _, v := range got.Videos {
		if !strings.HasPrefix(v.SrcURL, "/lalem/videos/") || !strings.HasSuffix(v.SrcURL, ".mp4") {
			t.Fatalf("video src %+v", v)
		}
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
	if len(got.Videos) < 1 {
		t.Fatal("canned digest still ships videos")
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
	if len(got.Videos) < 1 || len(got.Trends) == 0 {
		t.Fatalf("expected canned en digest %+v", got)
	}
}

var errLalemDown = errString("model down")

type errString string

func (e errString) Error() string { return string(e) }
