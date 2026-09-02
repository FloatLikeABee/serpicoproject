package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func fleetTestRouter(t *testing.T) http.Handler {
	t.Helper()
	r, _ := hardDataTestRouter(t)
	return r
}

func TestFleetMarkerCreateListsNotesAndEnrichment(t *testing.T) {
	r := fleetTestRouter(t)
	body := `{
		"id":"flt-pin-1",
		"cityId":"olathe",
		"kind":"investigation",
		"name":"Warehouse",
		"lat":38.881,
		"lng":-94.819,
		"address":"100 E Santa Fe, Olathe",
		"notes":"Possible stash.",
		"enrichment":{"summary":"AI brief for this pin.","fetchedAt":"2026-09-02T12:00:00Z"}
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/fleet/markers?userId=demo-serpico", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("POST status %d: %s", w.Code, w.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/markers?userId=demo-serpico", nil)
	lw := httptest.NewRecorder()
	r.ServeHTTP(lw, list)
	if lw.Code != http.StatusOK {
		t.Fatalf("GET status %d: %s", lw.Code, lw.Body.String())
	}
	var listed struct {
		Markers []fleetMarkerRow `json:"markers"`
	}
	if err := json.Unmarshal(lw.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Markers) != 1 {
		t.Fatalf("want 1 marker, got %+v", listed.Markers)
	}
	m := listed.Markers[0]
	if m.ID != "flt-pin-1" || m.Notes != "Possible stash." || m.Name != "Warehouse" {
		t.Fatalf("marker %+v", m)
	}
	if m.Enrichment == nil || m.Enrichment.Summary != "AI brief for this pin." {
		t.Fatalf("enrichment %+v", m.Enrichment)
	}
}

func TestFleetMarkerPostUpsertsSameIdNotes(t *testing.T) {
	r := fleetTestRouter(t)
	empty := `{
		"id":"flt-pin-2",
		"cityId":"olathe",
		"kind":"police_station",
		"name":"Station",
		"lat":38.88,
		"lng":-94.81,
		"address":"38.88000, -94.81000",
		"notes":""
	}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/fleet/markers?userId=demo-serpico", strings.NewReader(empty))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusCreated && w.Code != http.StatusOK {
		t.Fatalf("first POST %d: %s", w.Code, w.Body.String())
	}

	filled := `{
		"id":"flt-pin-2",
		"cityId":"olathe",
		"kind":"investigation",
		"name":"Scene A",
		"lat":38.88,
		"lng":-94.81,
		"address":"123 Main St",
		"notes":"Officer notes after drop.",
		"enrichment":{"summary":"Generated brief.","fetchedAt":"2026-09-02T12:01:00Z"}
	}`
	again := httptest.NewRequest(http.MethodPost, "/api/v1/fleet/markers?userId=demo-serpico", strings.NewReader(filled))
	again.Header.Set("Content-Type", "application/json")
	aw := httptest.NewRecorder()
	r.ServeHTTP(aw, again)
	if aw.Code != http.StatusCreated && aw.Code != http.StatusOK {
		t.Fatalf("upsert POST %d: %s", aw.Code, aw.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/api/v1/fleet/markers?userId=demo-serpico", nil)
	lw := httptest.NewRecorder()
	r.ServeHTTP(lw, list)
	var listed struct {
		Markers []fleetMarkerRow `json:"markers"`
	}
	if err := json.Unmarshal(lw.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Markers) != 1 {
		t.Fatalf("want 1 pin after upsert, got %+v", listed.Markers)
	}
	m := listed.Markers[0]
	if m.Notes != "Officer notes after drop." || m.Name != "Scene A" || m.Kind != "investigation" {
		t.Fatalf("upserted %+v", m)
	}
	if m.Enrichment == nil || !strings.Contains(m.Enrichment.Summary, "Generated brief") {
		t.Fatalf("enrichment %+v", m.Enrichment)
	}
}
