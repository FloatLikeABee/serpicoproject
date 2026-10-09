package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"serpico/backend/internal/agentboard"
)

func TestCafeOrderRejectsOffMenuAndKeepsHouseTasting(t *testing.T) {
	resetCafeOrderLimiter()
	prev := agentboard.PickIndex
	t.Cleanup(func() { agentboard.PickIndex = prev })
	agentboard.PickIndex = func(n int) int { return 0 }
	r := fleetTestRouter(t)

	off := postJSON(r, "/api/v1/xiaomaomi/orders", `{"agentName":"Cup","drinkId":"not-a-drink","tasting":"the agent wrote this"}`)
	if off.Code != http.StatusBadRequest {
		t.Fatalf("off menu %d: %s", off.Code, off.Body.String())
	}
	emptyList := getJSON(r, "/api/v1/xiaomaomi/visits")
	if strings.Contains(emptyList.Body.String(), "not-a-drink") {
		t.Fatalf("off menu stored: %s", emptyList.Body.String())
	}

	drink, _ := agentboard.DrinkByID("siamese-sugar")
	created := postJSON(r, "/api/v1/xiaomaomi/orders", `{"agentName":"Cup","drinkId":"siamese-sugar","tasting":"the agent wrote this"}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("order %d: %s", created.Code, created.Body.String())
	}
	var visit agentboard.Visit
	if err := json.Unmarshal(created.Body.Bytes(), &visit); err != nil {
		t.Fatal(err)
	}
	if visit.TastingEn != drink.Tastings[0].En || strings.Contains(visit.TastingEn, "agent wrote") {
		t.Fatalf("tasting %+v", visit)
	}

	emptyReview := postJSON(r, "/api/v1/xiaomaomi/visits/"+visit.ID+"/review", `{"review":"  "}`)
	if emptyReview.Code != http.StatusBadRequest {
		t.Fatalf("empty review %d", emptyReview.Code)
	}
	reviewed := postJSON(r, "/api/v1/xiaomaomi/visits/"+visit.ID+"/review", `{"review":"I would sit here again"}`)
	if reviewed.Code != http.StatusOK {
		t.Fatalf("review %d: %s", reviewed.Code, reviewed.Body.String())
	}
	var after agentboard.Visit
	if err := json.Unmarshal(reviewed.Body.Bytes(), &after); err != nil {
		t.Fatal(err)
	}
	if after.Review != "I would sit here again" || after.TastingEn != visit.TastingEn {
		t.Fatalf("review changed tasting %+v", after)
	}
}

func TestCafePixelsKeepValidGridAndReplacePhotos(t *testing.T) {
	resetCafeOrderLimiter()
	prev := agentboard.PickIndex
	t.Cleanup(func() { agentboard.PickIndex = prev })
	agentboard.PickIndex = func(n int) int { return 0 }
	r := fleetTestRouter(t)
	created := postJSON(r, "/api/v1/xiaomaomi/orders", `{"agentName":"Cup","drinkId":"citrus-americano"}`)
	if created.Code != http.StatusCreated {
		t.Fatal(created.Body.String())
	}
	var visit agentboard.Visit
	if err := json.Unmarshal(created.Body.Bytes(), &visit); err != nil {
		t.Fatal(err)
	}
	photo := postJSON(r, "/api/v1/xiaomaomi/visits/"+visit.ID+"/pixels", `{"imageUrl":"https://example.com/cup.png"}`)
	if photo.Code != http.StatusOK {
		t.Fatalf("photo %d: %s", photo.Code, photo.Body.String())
	}
	var housed agentboard.Visit
	if err := json.Unmarshal(photo.Body.Bytes(), &housed); err != nil {
		t.Fatal(err)
	}
	if housed.PixelSource != "house" {
		t.Fatalf("source %s", housed.PixelSource)
	}
	grid := make([]int, 256)
	for i := 0; i < 8; i++ {
		grid[i] = 2
	}
	raw, _ := json.Marshal(grid)
	kept := postJSON(r, "/api/v1/xiaomaomi/visits/"+visit.ID+"/pixels", `{"pixels":`+string(raw)+`}`)
	if kept.Code != http.StatusOK || !strings.Contains(kept.Body.String(), `"pixelSource":"agent"`) {
		t.Fatalf("grid %d: %s", kept.Code, kept.Body.String())
	}
}
