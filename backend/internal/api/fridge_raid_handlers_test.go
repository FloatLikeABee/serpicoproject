package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

type stubFridgeAI struct {
	adviseCalls int
	lastImage   int
}

func (s *stubFridgeAI) AdviseFridgeRaid(in ai.FridgeRaidAdviseInput) (*ai.FridgeRaidCards, error) {
	s.adviseCalls++
	s.lastImage = len(in.Image)
	return &ai.FridgeRaidCards{
		Season:     "summer",
		Locale:     "en",
		Disclaimer: "Culinary TCM-inspired ideas, not medical advice.",
		Suggestions: []ai.FridgeRaidSuggestion{
			{Title: "Tomato eggs", Hook: "Silky and tangy.", TCMNote: "Cooling in the heat.", Chips: []string{"开胃"}},
			{Title: "Egg drop soup", Hook: "Savory steam.", TCMNote: "Gentle on the stomach.", Chips: []string{"15 min"}},
		},
	}, nil
}

func fridgeRaidTestRouter(t *testing.T, aiService interface{}) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db, err := database.OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	r := gin.New()
	v1 := r.Group("/api/v1")
	SetupRoutes(v1, db, aiService)
	return r
}

func TestFridgeRaidChatTextSuggestions(t *testing.T) {
	resetFridgeRaidLimiter()
	stub := &stubFridgeAI{}
	r := fridgeRaidTestRouter(t, stub)
	w := postJSON(r, "/api/v1/fridge-raid/chat", `{"locale":"en","text":"eggs, tomatoes"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var got ai.FridgeRaidCards
	if err := json.Unmarshal(w.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	n := len(got.Suggestions)
	if n < 2 || n > 4 {
		t.Fatalf("suggestions=%d body=%s", n, w.Body.String())
	}
	if stub.adviseCalls != 1 {
		t.Fatalf("advise calls=%d", stub.adviseCalls)
	}
}

func TestFridgeRaidChatOversizedImageNeverCallsVision(t *testing.T) {
	resetFridgeRaidLimiter()
	stub := &stubFridgeAI{}
	r := fridgeRaidTestRouter(t, stub)
	raw := make([]byte, fridgeRaidMaxImageBytes+1)
	b64 := base64.StdEncoding.EncodeToString(raw)
	body := `{"locale":"en","imageBase64":"` + b64 + `","imageMime":"image/jpeg"}`
	w := postJSON(r, "/api/v1/fridge-raid/chat", body)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	if stub.adviseCalls != 0 {
		t.Fatalf("oversized image must not call advisor/vision, calls=%d", stub.adviseCalls)
	}
}

func TestFridgeRaidChatRateLimit(t *testing.T) {
	prev := fridgeRaidMaxAttempts
	fridgeRaidMaxAttempts = 3
	t.Cleanup(func() { fridgeRaidMaxAttempts = prev })
	resetFridgeRaidLimiter()
	stub := &stubFridgeAI{}
	r := fridgeRaidTestRouter(t, stub)
	var last *httptest.ResponseRecorder
	for i := 0; i < 4; i++ {
		last = postJSON(r, "/api/v1/fridge-raid/chat", `{"locale":"en","text":"eggs"}`)
	}
	if last.Code != http.StatusTooManyRequests {
		t.Fatalf("expected rate limit, got %d %s", last.Code, last.Body.String())
	}
}

func TestFridgeRaidChatDoesNotBreakOfficerChatRoute(t *testing.T) {
	r := fridgeRaidTestRouter(t, nil)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/chat", strings.NewReader(`{"message":"hello"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code == http.StatusNotFound {
		t.Fatalf("officer /chat route missing: %d %s", w.Code, w.Body.String())
	}
}
