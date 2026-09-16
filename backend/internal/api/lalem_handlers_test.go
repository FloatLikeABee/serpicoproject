package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"serpico/backend/internal/ai"
)

type stubLalemAI struct {
	stubFridgeAI
	digestCalls int
}

func (s *stubLalemAI) AdviseLalemDigest(in ai.LalemDigestInput) (*ai.LalemDigest, error) {
	s.digestCalls++
	locale := in.Locale
	if locale == "" {
		locale = "cn"
	}
	return &ai.LalemDigest{
		GeneratedAt: "2026-09-16T12:00:00Z",
		Locale:      locale,
		Disclaimer:  "Bathroom tips, not medical advice.",
		Trends: []ai.LalemTrend{
			{Kind: "entertainment", Title: "综艺夜", Hook: "今晚热聊。", ImageURL: "/lalem/trends/entertainment-1.svg"},
			{Kind: "fashion", Title: "新色号", Hook: "妆容换季。", ImageURL: "/lalem/trends/fashion-1.svg"},
		},
		Videos: []ai.LalemVideo{
			{Title: "娱乐热片", PosterURL: "/lalem/videos/hot-ent.jpg", SrcURL: "/lalem/videos/hot-ent.mp4"},
		},
		Useful: []string{"别蹲太久", "洗手"},
	}, nil
}

func getJSON(r http.Handler, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestLalemToiletsCatalogHasImages(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/lalem/toilets")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Toilets []ai.LalemToilet `json:"toilets"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Toilets) < 8 {
		t.Fatalf("toilets=%d", len(got.Toilets))
	}
	for _, item := range got.Toilets {
		if item.ImageURL == "" || strings.HasPrefix(item.ImageURL, "http") {
			t.Fatalf("image %+v", item)
		}
	}
}

func TestLalemToiletsFilterMatches(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/lalem/toilets?shape=squat&class=palace")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got struct {
		Toilets []ai.LalemToilet `json:"toilets"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Toilets) == 0 {
		t.Fatal("expected squat palace matches")
	}
	for _, item := range got.Toilets {
		if item.Shape != "squat" || item.Class != "palace" {
			t.Fatalf("filter leaked %+v", item)
		}
		if item.ImageURL == "" {
			t.Fatal("filtered item missing image")
		}
	}
}

func TestLalemDigestReturnsVideoSrc(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r := fridgeRaidTestRouter(t, stub)
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Videos) < 1 || !strings.Contains(got.Videos[0].SrcURL, ".mp4") {
		t.Fatalf("videos %+v", got.Videos)
	}
	if stub.digestCalls != 1 {
		t.Fatalf("digest calls=%d", stub.digestCalls)
	}
	w2 := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w2.Code != http.StatusOK {
		t.Fatalf("cache status %d", w2.Code)
	}
	if stub.digestCalls != 1 {
		t.Fatalf("cache should skip live advise, calls=%d", stub.digestCalls)
	}
}

func TestLalemDigestRateLimit(t *testing.T) {
	prev := lalemMaxAttempts
	lalemMaxAttempts = 3
	t.Cleanup(func() { lalemMaxAttempts = prev })
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r := fridgeRaidTestRouter(t, stub)
	var last *httptest.ResponseRecorder
	for i := 0; i < 4; i++ {
		last = getJSON(r, "/api/v1/lalem/digest?locale=en")
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("expected rate limit, got %d %s", last.Code, last.Body.String())
	}
}

func TestLalemDoesNotBreakOfficerChatRoute(t *testing.T) {
	r := fridgeRaidTestRouter(t, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", strings.NewReader(`{"message":"hello"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code == http.StatusNotFound {
		t.Fatalf("officer /chat route missing: %d %s", w.Code, w.Body.String())
	}
}

func TestLalemRateLimitDoesNotShareFridgeRaidBucket(t *testing.T) {
	prevL := lalemMaxAttempts
	prevF := fridgeRaidMaxAttempts
	lalemMaxAttempts = 8
	fridgeRaidMaxAttempts = 3
	t.Cleanup(func() {
		lalemMaxAttempts = prevL
		fridgeRaidMaxAttempts = prevF
	})
	resetLalemLimiter()
	resetLalemDigestCache()
	resetFridgeRaidLimiter()
	stub := &stubLalemAI{}
	r := fridgeRaidTestRouter(t, stub)
	for i := 0; i < 3; i++ {
		postJSON(r, "/api/v1/fridge-raid/chat", `{"locale":"en","text":"eggs"}`)
	}
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("lalem should not share fridge-raid quota, got %d %s", w.Code, w.Body.String())
	}
}
