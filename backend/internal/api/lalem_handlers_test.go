package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

type stubLalemAI struct {
	stubFridgeAI
	digestCalls  int
	lastMode     string
	incrementErr error
}

func (s *stubLalemAI) AdviseLalemDigest(in ai.LalemDigestInput) (*ai.LalemDigest, error) {
	s.digestCalls++
	s.lastMode = in.Mode
	locale := in.Locale
	if locale == "" {
		locale = "cn"
	}
	if in.Mode == "increment" {
		if s.incrementErr != nil {
			return nil, s.incrementErr
		}
		return &ai.LalemDigest{
			GeneratedAt: "2026-09-17T12:00:00Z",
			Locale:      locale,
			Disclaimer:  "Bathroom tips, not medical advice.",
			Trends: []ai.LalemTrend{
				{Kind: "entertainment", Title: "今日新综", Hook: "新弹幕。", ImageURL: "/lalem/trends/entertainment-2.svg"},
				{Kind: "fashion", Title: "今日新色", Hook: "新口红。", ImageURL: "/lalem/trends/fashion-2.svg"},
			},
			Videos: []ai.LalemVideo{
				{Title: "娱乐热片", PosterURL: "/lalem/videos/hot-ent.jpg", SrcURL: "/lalem/videos/hot-ent.mp4"},
			},
			Useful: []string{"新的有用一条"},
		}, nil
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
		if !strings.HasPrefix(item.WikiURLZh, "https://zh.wikipedia.org/") {
			t.Fatalf("wiki zh %+v", item)
		}
		if !strings.HasPrefix(item.WikiURLEn, "https://en.wikipedia.org/") {
			t.Fatalf("wiki en %+v", item)
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

func TestLalemPapersAndMedicineCatalogs(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r := fridgeRaidTestRouter(t, stub)
	w := getJSON(r, "/api/v1/lalem/papers")
	if w.Code != http.StatusOK {
		t.Fatalf("papers %d %s", w.Code, w.Body.String())
	}
	var papers struct {
		Papers []ai.LalemPaper `json:"papers"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &papers); err != nil {
		t.Fatal(err)
	}
	if len(papers.Papers) < 8 {
		t.Fatalf("papers=%d", len(papers.Papers))
	}
	for _, item := range papers.Papers {
		if !strings.HasPrefix(item.ImageURL, "/lalem/papers/") {
			t.Fatalf("paper image %+v", item)
		}
		if !strings.HasPrefix(item.WikiURLZh, "https://zh.wikipedia.org/") {
			t.Fatalf("paper wiki zh %+v", item)
		}
		if !strings.HasPrefix(item.WikiURLEn, "https://en.wikipedia.org/") {
			t.Fatalf("paper wiki en %+v", item)
		}
	}
	w2 := getJSON(r, "/api/v1/lalem/medicine")
	if w2.Code != http.StatusOK {
		t.Fatalf("medicine %d %s", w2.Code, w2.Body.String())
	}
	var med struct {
		Articles []ai.LalemMedicine `json:"articles"`
	}
	if err := json.Unmarshal(w2.Body.Bytes(), &med); err != nil {
		t.Fatal(err)
	}
	if len(med.Articles) < 7 {
		t.Fatalf("articles=%d", len(med.Articles))
	}
	if stub.digestCalls != 0 {
		t.Fatal("catalog GETs must not call the live model")
	}
}

func TestLalemDigestReturnsNoVideos(t *testing.T) {
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
	if len(got.Videos) != 0 {
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

func TestLalemDigestRateLimitOnGenerationOnly(t *testing.T) {
	prev := lalemMaxAttempts
	lalemMaxAttempts = 3
	t.Cleanup(func() { lalemMaxAttempts = prev })
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	var last *httptest.ResponseRecorder
	for i := 0; i < 4; i++ {
		r, _ := lalemRouterWithDB(t, stub)
		last = getJSON(r, "/api/v1/lalem/digest?locale=en")
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("expected generation rate limit, got %d %s", last.Code, last.Body.String())
	}
}

func TestLalemDigestWarmGetsDoNotRateLimit(t *testing.T) {
	prev := lalemMaxAttempts
	lalemMaxAttempts = 3
	t.Cleanup(func() { lalemMaxAttempts = prev })
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	seedLalemStore(t, db, "cn", "昨日综艺", "别蹲太久", time.Now())
	for i := 0; i < 8; i++ {
		w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
		if w.Code != http.StatusOK {
			t.Fatalf("warm GET %d status %d %s", i, w.Code, w.Body.String())
		}
	}
	if stub.digestCalls != 0 {
		t.Fatalf("warm GETs must not generate, calls=%d", stub.digestCalls)
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

func lalemRouterWithDB(t *testing.T, aiService interface{}) (*gin.Engine, *database.Database) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := database.OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	r := gin.New()
	SetupRoutes(r.Group("/api/v1"), db, aiService)
	return r, db
}

func seedLalemStore(t *testing.T, db *database.Database, locale string, trendTitle, usefulBody string, created time.Time) {
	t.Helper()
	if err := database.InsertLalemTrend(db.SQLite, database.LalemTrendRow{
		Locale: locale, Kind: "entertainment", Title: trendTitle, Hook: "hook", ImageURL: "/lalem/trends/entertainment-1.svg", CreatedAt: created,
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.InsertLalemUseful(db.SQLite, database.LalemUsefulRow{
		Locale: locale, Body: usefulBody, CreatedAt: created,
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.SetLalemFeedMeta(db.SQLite, locale, database.LalemShanghaiToday(created), created.UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
}

func TestLalemDigestReadsWarmStoreWithoutAdvise(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	seedLalemStore(t, db, "cn", "昨日综艺", "别蹲太久", now.Add(-time.Hour))
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 0 {
		t.Fatalf("warm store must not call advise, calls=%d", stub.digestCalls)
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 1 || got.Trends[0].Title != "昨日综艺" {
		t.Fatalf("trends %+v", got.Trends)
	}
	if got.Trends[0].ImageURL == "" {
		t.Fatal("trend missing image")
	}
	if len(got.Useful) != 1 || got.Useful[0] != "别蹲太久" {
		t.Fatalf("useful %+v", got.Useful)
	}
	if got.Disclaimer == "" {
		t.Fatal("disclaimer missing")
	}
	if len(got.Videos) != 0 {
		t.Fatalf("videos %+v", got.Videos)
	}
	if got.Trends[0].TopicID != "" {
		t.Fatalf("unmapped store trend should have empty topicId, got %q", got.Trends[0].TopicID)
	}
}

func TestLalemDigestStoreMapsSquatTrendToMedicine(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	if err := database.InsertLalemTrend(db.SQLite, database.LalemTrendRow{
		Locale: "cn", Kind: "entertainment", Title: "久蹲热搜", Hook: "今晚都在聊蹲姿", ImageURL: "/lalem/trends/entertainment-1.svg", CreatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.InsertLalemUseful(db.SQLite, database.LalemUsefulRow{
		Locale: "cn", Body: "洗手", CreatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	if err := database.SetLalemFeedMeta(db.SQLite, "cn", database.LalemShanghaiToday(now), now.UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 0 {
		t.Fatalf("warm store must not call advise, calls=%d", stub.digestCalls)
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 1 || got.Trends[0].TopicID != "medicine:posture-squat-sit" {
		t.Fatalf("topicId %+v", got.Trends)
	}
	if len(got.Videos) != 0 {
		t.Fatalf("videos %+v", got.Videos)
	}
}

func TestLalemDigestStoreKeepsLocalesSeparate(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	seedLalemStore(t, db, "cn", "中文热搜", "洗手中文", now)
	seedLalemStore(t, db, "en", "English only", "Wash hands", now)
	w := getJSON(r, "/api/v1/lalem/digest?locale=en")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 0 {
		t.Fatalf("warm store advise calls=%d", stub.digestCalls)
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 1 || got.Trends[0].Title != "English only" {
		t.Fatalf("en trends mixed %+v", got.Trends)
	}
	if len(got.Useful) != 1 || got.Useful[0] != "Wash hands" {
		t.Fatalf("en useful mixed %+v", got.Useful)
	}
}

func TestLalemDigestEmptyStoreSeedsThenReads(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 1 || stub.lastMode == "increment" {
		t.Fatalf("seed calls=%d mode=%q", stub.digestCalls, stub.lastMode)
	}
	stored, err := database.ListLalemTrends(db.SQLite, "cn")
	if err != nil || len(stored) < 2 {
		t.Fatalf("persisted trends %d err=%v", len(stored), err)
	}
	w2 := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w2.Code != http.StatusOK {
		t.Fatalf("second %d", w2.Code)
	}
	if stub.digestCalls != 1 {
		t.Fatalf("second GET must not advise, calls=%d", stub.digestCalls)
	}
}

func TestLalemDigestNewDayAppendsWithoutWiping(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	yesterday := now.Add(-25 * time.Hour)
	seedLalemStore(t, db, "cn", "昨日综艺", "昨日贴士", yesterday)
	if err := database.SetLalemFeedMeta(db.SQLite, "cn", database.LalemShanghaiToday(yesterday), yesterday.UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 1 || stub.lastMode != "increment" {
		t.Fatalf("increment calls=%d mode=%q", stub.digestCalls, stub.lastMode)
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	titles := map[string]bool{}
	for _, tr := range got.Trends {
		titles[tr.Title] = true
	}
	if !titles["昨日综艺"] || !titles["今日新综"] {
		t.Fatalf("expected yesterday kept and today appended, titles=%v", titles)
	}
	if len(got.Useful) < 2 {
		t.Fatalf("useful should keep yesterday plus one new, got %+v", got.Useful)
	}
}

func TestLalemDigestIncrementFailureKeepsPriorRows(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{incrementErr: errString("model down")}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	yesterday := now.Add(-25 * time.Hour)
	seedLalemStore(t, db, "cn", "昨日综艺", "昨日贴士", yesterday)
	if err := database.SetLalemFeedMeta(db.SQLite, "cn", database.LalemShanghaiToday(yesterday), yesterday.UTC().Format(time.RFC3339)); err != nil {
		t.Fatal(err)
	}
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Trends) != 1 || got.Trends[0].Title != "昨日综艺" {
		t.Fatalf("must keep prior rows %+v", got.Trends)
	}
	date, _, ok, err := database.GetLalemFeedMeta(db.SQLite, "cn")
	if err != nil || !ok || date != database.LalemShanghaiToday(yesterday) {
		t.Fatalf("must not bump increment date, date=%q ok=%v err=%v", date, ok, err)
	}
}

type errString string

func (e errString) Error() string { return string(e) }
