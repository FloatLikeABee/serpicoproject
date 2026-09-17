package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
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

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestLalemWikiAllowlistedReturnsSummary(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	var hits int
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hits++
		if r.Header.Get("User-Agent") == "" {
			t.Error("missing User-Agent")
		}
		if r.URL.Host != "zh.wikipedia.org" {
			t.Errorf("host %s", r.URL.Host)
		}
		if !strings.Contains(r.URL.Path, "/api/rest_v1/page/summary/") {
			t.Errorf("path %s", r.URL.Path)
		}
		body := `{"title":"公共厕所","extract":"古罗马公共厕所。","lang":"zh"}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    r,
		}, nil
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, stub)
	wiki := "https://zh.wikipedia.org/wiki/%E5%85%AC%E5%85%B1%E5%8E%95%E6%89%80"
	w := getJSON(r, "/api/v1/lalem/wiki?url="+url.QueryEscape(wiki))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if hits != 1 {
		t.Fatalf("upstream hits=%d", hits)
	}
	if stub.digestCalls != 0 {
		t.Fatalf("wiki GET must not call the live model, calls=%d", stub.digestCalls)
	}
	var got struct {
		Title     string `json:"title"`
		Extract   string `json:"extract"`
		Lang      string `json:"lang"`
		SourceURL string `json:"sourceUrl"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Title != "公共厕所" || got.Extract != "古罗马公共厕所。" {
		t.Fatalf("summary %+v", got)
	}
	if got.SourceURL != wiki {
		t.Fatalf("sourceUrl %q", got.SourceURL)
	}
}

func TestLalemWikiEnglishAllowlist(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "en.wikipedia.org" || !strings.Contains(r.URL.Path, "/Latrine") {
			t.Errorf("unexpected %s", r.URL.String())
		}
		body := `{"title":"Latrine","extract":"A communal latrine.","lang":"en"}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    r,
		}, nil
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/lalem/wiki?url="+url.QueryEscape("https://en.wikipedia.org/wiki/Latrine"))
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"extract":"A communal latrine."`) {
		t.Fatalf("body %s", w.Body.String())
	}
}

func TestLalemWikiRejectsOffHostWithoutUpstream(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	var hits int
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hits++
		return nil, errString("should not fetch")
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, stub)
	cases := []string{
		"https://example.com/",
		"http://zh.wikipedia.org/wiki/Latrine",
		"https://zh.wikipedia.org/wiki/",
		"https://zh.wikipedia.org/",
		"",
	}
	for _, raw := range cases {
		path := "/api/v1/lalem/wiki"
		if raw != "" {
			path += "?url=" + url.QueryEscape(raw)
		}
		w := getJSON(r, path)
		if w.Code < 400 || w.Code >= 500 {
			t.Fatalf("%q status %d %s", raw, w.Code, w.Body.String())
		}
		if w.Code == http.StatusNotFound {
			t.Fatalf("%q must be handled, not missing route: %d", raw, w.Code)
		}
	}
	if hits != 0 {
		t.Fatalf("rejected URLs must not hit Wikipedia, hits=%d", hits)
	}
	if stub.digestCalls != 0 {
		t.Fatalf("wiki reject must not call the live model, calls=%d", stub.digestCalls)
	}
}

func TestLalemWikiBlocksOffHostRedirect(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	var hosts []string
	prev := lalemWikiClient
	lalemWikiClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		hosts = append(hosts, r.URL.Host)
		if r.URL.Host == "zh.wikipedia.org" {
			return &http.Response{
				StatusCode: http.StatusFound,
				Header:     http.Header{"Location": []string{"https://example.com/owned"}},
				Body:       io.NopCloser(strings.NewReader("")),
				Request:    r,
			}, nil
		}
		t.Errorf("followed redirect to %s", r.URL.String())
		return nil, errString("should not follow")
	})}
	t.Cleanup(func() { lalemWikiClient = prev })
	r := fridgeRaidTestRouter(t, &stubLalemAI{})
	w := getJSON(r, "/api/v1/lalem/wiki?url="+url.QueryEscape("https://zh.wikipedia.org/wiki/%E5%85%AC%E5%85%B1%E5%8E%95%E6%89%80"))
	if w.Code != http.StatusBadGateway {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	for _, host := range hosts {
		if host == "example.com" {
			t.Fatal("must not fetch redirect host")
		}
	}
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
	if len(med.Articles) < 50 {
		t.Fatalf("articles=%d want >=50", len(med.Articles))
	}
	if stub.digestCalls != 0 {
		t.Fatal("catalog GETs must not call the live model")
	}
}

func TestLalemDigestNoDBStripsStubVideos(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	SetupRoutes(r.Group("/api/v1"), nil, stub)
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if len(got.Videos) != 0 {
		t.Fatalf("nil-DB digest must strip videos %+v", got.Videos)
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
	seedLalemStore(t, db, "cn", "昨日综艺", "别蹲太久", now)
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
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 || !titles["昨日综艺"] {
		t.Fatalf("warm short store should keep yesterday and top up, unique=%d titles=%v", len(titles), titles)
	}
	var kept *ai.LalemTrend
	for i := range got.Trends {
		if got.Trends[i].Title == "昨日综艺" {
			kept = &got.Trends[i]
			break
		}
	}
	if kept == nil || kept.ImageURL == "" {
		t.Fatal("trend missing image")
	}
	if !strings.HasSuffix(kept.ImageURL, ".jpg") {
		t.Fatalf("legacy svg should rewrite to jpg, got %s", kept.ImageURL)
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
	if kept.TopicID != "" {
		t.Fatalf("unmapped store trend should have empty topicId, got %q", kept.TopicID)
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
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 || !titles["久蹲热搜"] {
		t.Fatalf("unique=%d titles=%v", len(titles), titles)
	}
	var squat *ai.LalemTrend
	for i := range got.Trends {
		if got.Trends[i].Title == "久蹲热搜" {
			squat = &got.Trends[i]
			break
		}
	}
	if squat == nil || squat.TopicID != "medicine:posture-squat-sit" {
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
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 || !titles["English only"] {
		t.Fatalf("en trends unique=%d %+v", len(titles), got.Trends)
	}
	if titles["中文热搜"] {
		t.Fatalf("en trends mixed %+v", got.Trends)
	}
	if len(got.Useful) != 1 || got.Useful[0] != "Wash hands" {
		t.Fatalf("en useful mixed %+v", got.Useful)
	}
}

func lalemTrendTitles(trends []ai.LalemTrend) map[string]bool {
	out := map[string]bool{}
	for _, tr := range trends {
		out[strings.TrimSpace(tr.Title)] = true
	}
	return out
}

func seedLalemTrends(t *testing.T, db *database.Database, locale string, titles []string, created time.Time) {
	t.Helper()
	for i, title := range titles {
		img := "/lalem/trends/entertainment-1.jpg"
		if i%2 == 1 {
			img = "/lalem/trends/fashion-1.jpg"
		}
		if err := database.InsertLalemTrend(db.SQLite, database.LalemTrendRow{
			Locale: locale, Kind: "entertainment", Title: title, Hook: "hook", ImageURL: img, CreatedAt: created,
		}); err != nil {
			t.Fatal(err)
		}
	}
}

func TestLalemDigestEmptyStoreSeedsAtLeastFiftyUnique(t *testing.T) {
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
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 {
		t.Fatalf("unique titles=%d want >=50 got %v", len(titles), titles)
	}
	if len(got.Videos) != 0 {
		t.Fatalf("videos %+v", got.Videos)
	}
	stored, err := database.ListLalemTrends(db.SQLite, "cn")
	if err != nil || len(stored) < 50 {
		t.Fatalf("persisted trends %d err=%v", len(stored), err)
	}
}

func TestLalemDigestWarmEightRowsTopUpKeepsThem(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	kept := []string{"昨日综艺", "旧色号", "隔间夜话", "马桶红毯", "短剧加更", "卫衣叠穿", "厕所K歌", "镜前刘海"}
	seedLalemTrends(t, db, "cn", kept, now)
	if err := database.InsertLalemUseful(db.SQLite, database.LalemUsefulRow{
		Locale: "cn", Body: "别蹲太久", CreatedAt: now,
	}); err != nil {
		t.Fatal(err)
	}
	gen := "2026-01-01T00:00:00Z"
	if err := database.SetLalemFeedMeta(db.SQLite, "cn", database.LalemShanghaiToday(now), gen); err != nil {
		t.Fatal(err)
	}
	w := getJSON(r, "/api/v1/lalem/digest?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 0 {
		t.Fatalf("top-up must not call live advise, calls=%d", stub.digestCalls)
	}
	var got ai.LalemDigest
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 {
		t.Fatalf("unique titles=%d want >=50", len(titles))
	}
	for _, title := range kept {
		if !titles[title] {
			t.Fatalf("missing stored title %s in %v", title, titles)
		}
	}
	if len(got.Videos) != 0 {
		t.Fatalf("videos %+v", got.Videos)
	}
	date, generated, ok, err := database.GetLalemFeedMeta(db.SQLite, "cn")
	if err != nil || !ok || date != database.LalemShanghaiToday(now) || generated != gen {
		t.Fatalf("top-up bumped meta date=%q gen=%q ok=%v err=%v", date, generated, ok, err)
	}
}

func TestLalemDigestNewDayAppendsTwoWithoutDroppingFloor(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	stub := &stubLalemAI{}
	r, db := lalemRouterWithDB(t, stub)
	now := time.Now()
	yesterday := now.Add(-25 * time.Hour)
	kept := []string{"昨日综艺", "旧色号", "隔间夜话", "马桶红毯", "短剧加更", "卫衣叠穿", "厕所K歌", "镜前刘海"}
	seedLalemTrends(t, db, "cn", kept, yesterday)
	if err := database.InsertLalemUseful(db.SQLite, database.LalemUsefulRow{
		Locale: "cn", Body: "昨日贴士", CreatedAt: yesterday,
	}); err != nil {
		t.Fatal(err)
	}
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
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 {
		t.Fatalf("unique titles=%d want >=50", len(titles))
	}
	for _, title := range kept {
		if !titles[title] {
			t.Fatalf("missing stored title %s", title)
		}
	}
	if !titles["今日新综"] || !titles["今日新色"] {
		t.Fatalf("expected increment titles, got %v", titles)
	}
	if len(got.Useful) < 2 {
		t.Fatalf("useful should keep yesterday plus one new, got %+v", got.Useful)
	}
	if len(got.Videos) != 0 {
		t.Fatalf("videos %+v", got.Videos)
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
	titles := lalemTrendTitles(got.Trends)
	if len(titles) < 50 || !titles["昨日综艺"] {
		t.Fatalf("must keep prior rows and floor, unique=%d %+v", len(titles), got.Trends)
	}
	if titles["今日新综"] {
		t.Fatalf("failed increment must not persist live titles %+v", titles)
	}
	date, _, ok, err := database.GetLalemFeedMeta(db.SQLite, "cn")
	if err != nil || !ok || date != database.LalemShanghaiToday(yesterday) {
		t.Fatalf("must not bump increment date, date=%q ok=%v err=%v", date, ok, err)
	}
}

func TestLalemCompanionGetReturnsLocaleLine(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	resetLalemCompanionLimiter()
	r := fridgeRaidTestRouter(t, &ai.LalemAdvisor{})
	for _, loc := range []string{"cn", "en"} {
		w := getJSON(r, "/api/v1/lalem/companion?locale="+loc)
		if w.Code != http.StatusOK {
			t.Fatalf("%s status %d: %s", loc, w.Code, w.Body.String())
		}
		var got struct {
			Text  string `json:"text"`
			Angle string `json:"angle"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if strings.TrimSpace(got.Text) == "" {
			t.Fatalf("%s empty text %+v", loc, got)
		}
		switch got.Angle {
		case "medical", "biological", "social", "historical":
		default:
			t.Fatalf("%s angle %q", loc, got.Angle)
		}
		low := strings.ToLower(got.Text)
		if strings.Contains(low, "you have") || strings.Contains(got.Text, "你患有") {
			t.Fatalf("%s diagnostic %q", loc, got.Text)
		}
		if loc == "cn" && !companionBodyHasHan(got.Text) {
			t.Fatalf("cn companion should be Chinese: %q", got.Text)
		}
		if loc == "en" && companionBodyHasHan(got.Text) {
			t.Fatalf("en companion should be English: %q", got.Text)
		}
	}
}

func TestLalemCompanionLimiterIndependentOfDigest(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	resetLalemCompanionLimiter()
	for _, ip := range []string{"", "unknown", "192.0.2.1", "127.0.0.1"} {
		for i := 0; i < lalemMaxAttempts+2; i++ {
			_ = lalemAllowed(ip)
		}
	}
	calls := 0
	adv := &ai.LalemAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			calls++
			return `{"text":"Roman latrines were chatty stone benches.","angle":"historical"}`, nil
		},
	}
	r := fridgeRaidTestRouter(t, adv)
	w := getJSON(r, "/api/v1/lalem/companion?locale=en")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got ai.LalemCompanion
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Text != "Roman latrines were chatty stone benches." {
		t.Fatalf("exhausted digest limiter must not block companion live line: %q", got.Text)
	}
	if calls != 1 {
		t.Fatalf("live calls=%d", calls)
	}
	w2 := getJSON(r, "/api/v1/lalem/companion?locale=en")
	if w2.Code != http.StatusOK {
		t.Fatalf("second status %d: %s", w2.Code, w2.Body.String())
	}
	if calls != 1 {
		t.Fatalf("second GET must use canned, live calls=%d", calls)
	}
}

func TestLalemCompanionGetDoesNotCallDigest(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	resetLalemCompanionLimiter()
	stub := &stubLalemAI{}
	r := fridgeRaidTestRouter(t, stub)
	w := getJSON(r, "/api/v1/lalem/companion?locale=cn")
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 0 {
		t.Fatalf("companion GET must not increment digest, calls=%d", stub.digestCalls)
	}
}

func TestLalemChatPostReturnsLocaleReply(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	resetLalemCompanionLimiter()
	resetLalemChatLimiter()
	r := fridgeRaidTestRouter(t, &ai.LalemAdvisor{})
	for _, loc := range []string{"cn", "en"} {
		w := postJSON(r, "/api/v1/lalem/chat", `{"locale":"`+loc+`","message":"bristol type 4"}`)
		if w.Code != http.StatusOK {
			t.Fatalf("%s status %d: %s", loc, w.Code, w.Body.String())
		}
		var got struct {
			Reply string `json:"reply"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if strings.TrimSpace(got.Reply) == "" {
			t.Fatalf("%s empty reply %+v", loc, got)
		}
		low := strings.ToLower(got.Reply)
		if strings.Contains(low, "you have") || strings.Contains(got.Reply, "你患有") {
			t.Fatalf("%s diagnostic %q", loc, got.Reply)
		}
		if loc == "cn" && !companionBodyHasHan(got.Reply) {
			t.Fatalf("cn chat should be Chinese: %q", got.Reply)
		}
		if loc == "en" && companionBodyHasHan(got.Reply) {
			t.Fatalf("en chat should be English: %q", got.Reply)
		}
	}
}

func TestLalemChatLimiterIndependentOfDigestAndCompanion(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	resetLalemCompanionLimiter()
	resetLalemChatLimiter()
	for _, ip := range []string{"", "unknown", "192.0.2.1", "127.0.0.1"} {
		for i := 0; i < lalemMaxAttempts+2; i++ {
			_ = lalemAllowed(ip)
		}
		for i := 0; i < lalemCompMax+2; i++ {
			_ = lalemCompanionLiveAllowed(ip)
		}
	}
	calls := 0
	adv := &ai.LalemAdvisor{
		CompleteFn: func(prompt string) (string, error) {
			calls++
			return `{"reply":"Roman latrines were chatty stone benches. Funny poop history."}`, nil
		},
	}
	r := fridgeRaidTestRouter(t, adv)
	w := postJSON(r, "/api/v1/lalem/chat", `{"locale":"en","message":"roman toilets"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got ai.LalemChat
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got.Reply, "Roman latrines") {
		t.Fatalf("exhausted digest/companion limiter must not block chat live line: %q", got.Reply)
	}
	if calls != 1 {
		t.Fatalf("live calls=%d", calls)
	}
}

func TestLalemChatPostDoesNotCallDigest(t *testing.T) {
	resetLalemLimiter()
	resetLalemDigestCache()
	resetLalemCompanionLimiter()
	resetLalemChatLimiter()
	stub := &stubLalemAI{}
	r := fridgeRaidTestRouter(t, stub)
	w := postJSON(r, "/api/v1/lalem/chat", `{"locale":"cn","message":"便便"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.digestCalls != 0 {
		t.Fatalf("chat POST must not increment digest, calls=%d", stub.digestCalls)
	}
}

func companionBodyHasHan(s string) bool {
	for _, r := range s {
		if r >= 0x4e00 && r <= 0x9fff {
			return true
		}
	}
	return false
}

type errString string

func (e errString) Error() string { return string(e) }
