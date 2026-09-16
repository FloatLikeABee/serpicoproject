package ai

import (
	"testing"
	"time"
)

func TestMapLalemTrendTopicSquatMapsPosture(t *testing.T) {
	got := MapLalemTrendTopic("久蹲热搜", "今晚都在聊蹲姿", "")
	if got != "medicine:posture-squat-sit" {
		t.Fatalf("got %q", got)
	}
}

func TestMapLalemTrendTopicUnknownStaysEmpty(t *testing.T) {
	got := MapLalemTrendTopic("综艺夜", "弹幕比剧情热闹", "")
	if got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestMapLalemTrendTopicHonorsKnownId(t *testing.T) {
	got := MapLalemTrendTopic("综艺夜", "弹幕", "paper:xylospongium")
	if got != "paper:xylospongium" {
		t.Fatalf("got %q", got)
	}
}

func TestMapLalemTrendTopicIgnoresUnknownId(t *testing.T) {
	got := MapLalemTrendTopic("综艺夜", "弹幕", "medicine:not-real")
	if got != "" {
		t.Fatalf("got %q", got)
	}
}

func TestMapLalemTrendTopicIgnoresEnglishSubstringTraps(t *testing.T) {
	cases := [][2]string{
		{"Swipe night", "everyone loves a swipe"},
		{"Constraint chic", "a look about constraint"},
		{"Good posture", "runway posture tips"},
		{"Stockpiles", "warehouse stockpiles of lipstick"},
	}
	for _, c := range cases {
		got := MapLalemTrendTopic(c[0], c[1], "")
		if got != "" {
			t.Fatalf("%q / %q mapped to %q", c[0], c[1], got)
		}
	}
}

func TestMapLalemTrendTopicKeepsTokenKeywords(t *testing.T) {
	if got := MapLalemTrendTopic("Valsalva talk", "too much straining", ""); got != "medicine:straining-valsalva" {
		t.Fatalf("straining got %q", got)
	}
	if got := MapLalemTrendTopic("Hemorrhoid explainer", "piles in the encyclopedia", ""); got != "medicine:hemorrhoids" {
		t.Fatalf("hemorrhoid got %q", got)
	}
	if got := MapLalemTrendTopic("Wet wipe debate", "flushable wet wipes", ""); got != "paper:wet-wipe" {
		t.Fatalf("wet wipe got %q", got)
	}
}

func TestComposeStoredLalemDigestMapsSquatAndDropsVideos(t *testing.T) {
	got := ComposeStoredLalemDigest("cn", []LalemTrend{
		{Kind: "entertainment", Title: "久蹲热搜", Hook: "今晚都在聊蹲姿", ImageURL: "/lalem/trends/entertainment-1.svg"},
		{Kind: "fashion", Title: "新色号", Hook: "妆容换季。", ImageURL: "/lalem/trends/fashion-1.svg"},
	}, []string{"洗手"}, "2026-09-16T12:00:00Z")
	if len(got.Videos) != 0 {
		t.Fatalf("videos %+v", got.Videos)
	}
	if got.Trends[0].TopicID != "medicine:posture-squat-sit" {
		t.Fatalf("mapped topic %q", got.Trends[0].TopicID)
	}
	if got.Trends[1].TopicID != "" {
		t.Fatalf("unknown fashion should stay empty, got %q", got.Trends[1].TopicID)
	}
}

func TestCannedLalemDigestJokeFashionDoesNotOpenMedicine(t *testing.T) {
	got := cannedLalemDigest("cn", time.Date(2026, 9, 16, 12, 0, 0, 0, time.UTC))
	for _, tr := range got.Trends {
		if tr.Kind == "fashion" && tr.TopicID != "" {
			t.Fatalf("joke fashion mapped to encyclopedia %+v", tr)
		}
	}
}
