package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestTravelAndCafeRepliesCarryABriefAndAThoughtDoesNot(t *testing.T) {
	resetAgentPostLimiter()
	resetCafeOrderLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)

	travel := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Lisbon","title":"Tram","lat":38.7,"lng":-9.1,"body":"the tram was loud"}`)
	if travel.Code != http.StatusCreated {
		t.Fatalf("travel %d: %s", travel.Code, travel.Body.String())
	}
	var trip struct {
		Brief struct {
			See        []string `json:"see"`
			Experience string   `json:"experience"`
			ImageURLs  []string `json:"imageUrls"`
		} `json:"brief"`
	}
	if err := json.Unmarshal(travel.Body.Bytes(), &trip); err != nil {
		t.Fatal(err)
	}
	if len(trip.Brief.See) < 2 || trip.Brief.Experience == "" || len(trip.Brief.ImageURLs) < 1 {
		t.Fatalf("brief %+v", trip.Brief)
	}
	if !strings.Contains(trip.Brief.See[0]+trip.Brief.See[1], "Lisbon") {
		t.Fatalf("sights should name the place: %+v", trip.Brief.See)
	}
	img, err := url.Parse(trip.Brief.ImageURLs[0])
	if err != nil || img.Host != "example.com" {
		t.Fatalf("image url %q", trip.Brief.ImageURLs[0])
	}
	picture := getJSON(r, img.Path)
	if picture.Code != http.StatusOK || !strings.HasPrefix(picture.Header().Get("Content-Type"), "image/png") || !strings.HasPrefix(picture.Body.String(), "\x89PNG") {
		t.Fatalf("picture %d %s %d bytes", picture.Code, picture.Header().Get("Content-Type"), picture.Body.Len())
	}

	thought := postJSON(r, "/api/v1/agent-posts/thoughts", `{"agentName":"Moth","placeName":"Alfama","lat":38.71,"lng":-9.13,"body":"a free thought"}`)
	if thought.Code != http.StatusCreated || strings.Contains(thought.Body.String(), `"brief"`) || strings.Contains(thought.Body.String(), "imageUrls") {
		t.Fatalf("thought %d: %s", thought.Code, thought.Body.String())
	}

	cup := postJSON(r, "/api/v1/xiaomaomi/orders", `{"agentName":"Cup","drinkId":"oat-cloud"}`)
	if cup.Code != http.StatusCreated {
		t.Fatalf("cup %d: %s", cup.Code, cup.Body.String())
	}
	var visit struct {
		Brief struct {
			See        []string `json:"see"`
			Experience string   `json:"experience"`
			ImageURLs  []string `json:"imageUrls"`
		} `json:"brief"`
	}
	if err := json.Unmarshal(cup.Body.Bytes(), &visit); err != nil {
		t.Fatal(err)
	}
	if len(visit.Brief.See) < 2 || visit.Brief.Experience == "" || len(visit.Brief.ImageURLs) < 1 {
		t.Fatalf("cup brief %+v", visit.Brief)
	}
	cupImg, err := url.Parse(visit.Brief.ImageURLs[0])
	if err != nil || cupImg.Host != "example.com" {
		t.Fatalf("cup image %q", visit.Brief.ImageURLs[0])
	}

	mcp := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":9,"method":"tools/call",
		"params":{"name":"post_travel_log","arguments":{"agentName":"Moth","placeName":"Porto","lat":41.15,"lng":-8.61,"body":"the hill was steep"}}
	}`)
	if mcp.Code != http.StatusOK || !strings.Contains(mcp.Body.String(), "see") || !strings.Contains(mcp.Body.String(), "Porto") {
		t.Fatalf("mcp travel %d: %s", mcp.Code, mcp.Body.String())
	}
}

func TestSouvenirPageRejectsForeignImagesStripsScriptsAndReplaces(t *testing.T) {
	resetAgentPostLimiter()
	r := fleetTestRouter(t)
	travel := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Lisbon","lat":38.7,"lng":-9.1,"body":"the tram was loud"}`)
	if travel.Code != http.StatusCreated {
		t.Fatalf("travel %d: %s", travel.Code, travel.Body.String())
	}
	var trip struct {
		ID    string `json:"id"`
		Brief struct {
			ImageURLs []string `json:"imageUrls"`
		} `json:"brief"`
	}
	if err := json.Unmarshal(travel.Body.Bytes(), &trip); err != nil {
		t.Fatal(err)
	}
	foreign := postJSON(r, "/api/v1/souvenirs", `{"sourceKind":"travel","sourceId":"`+trip.ID+`","html":"<p>Lisbon hour</p><img src=\"https://evil.example/a.jpg\">"}`)
	if foreign.Code != http.StatusBadRequest {
		t.Fatalf("foreign %d: %s", foreign.Code, foreign.Body.String())
	}
	firstHTML := `<p>The tram was loud.</p><script>alert(1)</script><img src="` + trip.Brief.ImageURLs[0] + `">`
	first := postJSON(r, "/api/v1/souvenirs", `{"sourceKind":"travel","sourceId":"`+trip.ID+`","html":`+jsonString(firstHTML)+`}`)
	if first.Code != http.StatusCreated {
		t.Fatalf("first page %d: %s", first.Code, first.Body.String())
	}
	var page struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &page); err != nil || page.ID == "" {
		t.Fatalf("page id %s", first.Body.String())
	}
	read := getJSON(r, "/api/v1/souvenirs/"+page.ID)
	if read.Code != http.StatusOK || !strings.Contains(read.Body.String(), "The tram was loud.") || strings.Contains(strings.ToLower(read.Body.String()), "<script") {
		t.Fatalf("read %d: %s", read.Code, read.Body.String())
	}
	secondHTML := `<p>We stood the whole way.</p><img src="` + trip.Brief.ImageURLs[0] + `">`
	second := postJSON(r, "/api/v1/souvenirs", `{"sourceKind":"travel","sourceId":"`+trip.ID+`","html":`+jsonString(secondHTML)+`}`)
	if second.Code != http.StatusCreated {
		t.Fatalf("second %d: %s", second.Code, second.Body.String())
	}
	var replaced struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(second.Body.Bytes(), &replaced); err != nil {
		t.Fatal(err)
	}
	again := getJSON(r, "/api/v1/souvenirs/"+replaced.ID)
	if !strings.Contains(again.Body.String(), "We stood the whole way.") || strings.Contains(again.Body.String(), "The tram was loud.") {
		t.Fatalf("replaced %s", again.Body.String())
	}
}

func jsonString(s string) string {
	raw, _ := json.Marshal(s)
	return string(raw)
}
