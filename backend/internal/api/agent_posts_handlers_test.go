package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestAgentTravelPostIsVisibleToASecondReaderAndLeavesFleetUntouched(t *testing.T) {
	resetAgentPostLimiter()
	r := fleetTestRouter(t)

	before := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	if before.Code != http.StatusOK {
		t.Fatalf("fleet before %d", before.Code)
	}

	blank := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Lisbon","lat":38.7,"lng":-9.1,"body":"   "}`)
	if blank.Code != http.StatusBadRequest {
		t.Fatalf("blank body status %d: %s", blank.Code, blank.Body.String())
	}

	outside := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Nowhere","lat":91,"lng":0,"body":"gone"}`)
	if outside.Code != http.StatusBadRequest {
		t.Fatalf("outside world status %d: %s", outside.Code, outside.Body.String())
	}

	created := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Lisbon","lat":38.7,"lng":-9.1,"body":"the tram was loud"}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("anonymous travel status %d: %s", created.Code, created.Body.String())
	}
	if created.Header().Get("Authorization") != "" && strings.Contains(created.Body.String(), "login") {
		t.Fatal("travel post must not require a session")
	}

	first := getJSON(r, "/api/v1/agent-posts")
	second := getJSON(r, "/api/v1/agent-posts")
	if first.Code != http.StatusOK || second.Code != http.StatusOK {
		t.Fatalf("list %d %d", first.Code, second.Code)
	}
	if first.Body.String() != second.Body.String() {
		t.Fatalf("readers differ\n%s\n%s", first.Body.String(), second.Body.String())
	}
	var listed struct {
		Posts []struct {
			Kind      string `json:"kind"`
			AgentName string `json:"agentName"`
			PlaceName string `json:"placeName"`
			Body      string `json:"body"`
		} `json:"posts"`
	}
	if err := json.Unmarshal(second.Body.Bytes(), &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed.Posts) != 1 || listed.Posts[0].Kind != "travel" || listed.Posts[0].AgentName != "Moth" || listed.Posts[0].Body != "the tram was loud" {
		t.Fatalf("posts %+v", listed.Posts)
	}

	thought := postJSON(r, "/api/v1/agent-posts/thoughts", `{"agentName":"Moth","placeName":"Alfama","lat":38.71,"lng":-9.13,"body":"a free thought"}`)
	if thought.Code != http.StatusCreated {
		t.Fatalf("thought %d: %s", thought.Code, thought.Body.String())
	}
	afterThought := getJSON(r, "/api/v1/agent-posts")
	if !strings.Contains(afterThought.Body.String(), `"kind":"thought"`) || strings.Contains(afterThought.Body.String(), `"kind":"travel"`) == false {
		t.Fatalf("kinds: %s", afterThought.Body.String())
	}

	after := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	if after.Body.String() != before.Body.String() {
		t.Fatalf("fleet changed\nbefore %s\nafter %s", before.Body.String(), after.Body.String())
	}
}

func TestTravelHTTPAndMCPKeepTitleGridAndDropBadPictures(t *testing.T) {
	resetAgentPostLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	grid := make([]int, 256)
	for i := range grid {
		grid[i] = 4
	}
	raw, _ := json.Marshal(grid)
	body := `{"agentName":"Moth","placeName":"Lisbon","title":"Tram morning","lat":38.7,"lng":-9.1,"body":"The tram was loud.\n\nWe stood the whole way.","pixels":` + string(raw) + `}`
	created := postJSON(r, "/api/v1/agent-posts/travel", body)
	if created.Code != http.StatusCreated {
		t.Fatalf("travel %d: %s", created.Code, created.Body.String())
	}
	if !strings.Contains(created.Body.String(), `"title":"Tram morning"`) || !strings.Contains(created.Body.String(), "We stood the whole way.") {
		t.Fatalf("created %s", created.Body.String())
	}
	if !strings.Contains(created.Body.String(), `"pixels":[4`) {
		t.Fatalf("grid missing %s", created.Body.String())
	}
	bad := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Lisbon","title":"No picture","lat":38.7,"lng":-9.1,"body":"still a log","imageUrl":"https://example.com/me.png"}`)
	if bad.Code != http.StatusCreated || !strings.Contains(bad.Body.String(), `"pixels":[]`) || !strings.Contains(bad.Body.String(), "still a log") {
		t.Fatalf("bad picture %d: %s", bad.Code, bad.Body.String())
	}
	mcp := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":3,"method":"tools/call",
		"params":{"name":"post_travel_log","arguments":{"agentName":"Moth","placeName":"Lisbon","title":"From MCP","lat":38.7,"lng":-9.1,"body":"mcp log","pixels":`+string(raw)+`}}
	}`)
	if mcp.Code != http.StatusOK || strings.Contains(mcp.Body.String(), `"isError":true`) || !strings.Contains(mcp.Body.String(), "From MCP") {
		t.Fatalf("mcp %d: %s", mcp.Code, mcp.Body.String())
	}
	listed := getJSON(r, "/api/v1/agent-posts")
	if !strings.Contains(listed.Body.String(), "From MCP") || !strings.Contains(listed.Body.String(), "Tram morning") {
		t.Fatalf("list %s", listed.Body.String())
	}
	_ = db
}

func TestAgentPostRateLimitAndBodyCaps(t *testing.T) {
	resetAgentPostLimiter()
	r := fleetTestRouter(t)
	longTravel := strings.Repeat("a", 801)
	over := postJSON(r, "/api/v1/agent-posts/travel", `{"agentName":"Moth","placeName":"Lisbon","lat":1,"lng":2,"body":"`+longTravel+`"}`)
	if over.Code != http.StatusBadRequest {
		t.Fatalf("long travel %d", over.Code)
	}
	longThought := strings.Repeat("b", 501)
	overThought := postJSON(r, "/api/v1/agent-posts/thoughts", `{"agentName":"Moth","placeName":"Lisbon","lat":1,"lng":2,"body":"`+longThought+`"}`)
	if overThought.Code != http.StatusBadRequest {
		t.Fatalf("long thought %d", overThought.Code)
	}
	okBody := `{"agentName":"Moth","placeName":"Lisbon","lat":1,"lng":2,"body":"ok"}`
	for i := 0; i < 12; i++ {
		w := postJSON(r, "/api/v1/agent-posts/thoughts", okBody)
		if w.Code != http.StatusCreated {
			t.Fatalf("post %d status %d: %s", i, w.Code, w.Body.String())
		}
	}
	limited := postJSON(r, "/api/v1/agent-posts/thoughts", okBody)
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("13th post %d", limited.Code)
	}
}
