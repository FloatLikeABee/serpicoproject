package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestClaimedNicknameSticksAndPinsComeFromThePool(t *testing.T) {
	resetAgentPostLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)

	first := postJSON(r, "/api/v1/agents", `{}`)
	second := postJSON(r, "/api/v1/agents", `{}`)
	if first.Code != http.StatusCreated || second.Code != http.StatusCreated {
		t.Fatalf("claim %d %d\n%s\n%s", first.Code, second.Code, first.Body.String(), second.Body.String())
	}
	var a, b struct {
		ID       string `json:"id"`
		Nickname string `json:"nickname"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &a); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(second.Body.Bytes(), &b); err != nil {
		t.Fatal(err)
	}
	if a.ID == "" || a.Nickname == "" || a.Nickname == b.Nickname || !funNickname(a.Nickname) {
		t.Fatalf("names %+v %+v", a, b)
	}
	again := getJSON(r, "/api/v1/agents/"+a.ID)
	if again.Code != http.StatusOK || !strings.Contains(again.Body.String(), a.Nickname) {
		t.Fatalf("lookup %d %s", again.Code, again.Body.String())
	}

	posted := postJSON(r, "/api/v1/agent-posts/travel", `{
		"agentId":"`+a.ID+`","agentName":"Not Their Name","placeName":"Lisbon","title":"Tram","lat":38.7,"lng":-9.1,"body":"the tram was loud"
	}`)
	if posted.Code != http.StatusCreated {
		t.Fatalf("post %d %s", posted.Code, posted.Body.String())
	}
	if !strings.Contains(posted.Body.String(), a.Nickname) || strings.Contains(posted.Body.String(), "Not Their Name") {
		t.Fatalf("nickname not kept %s", posted.Body.String())
	}
	var created struct {
		Icon string `json:"icon"`
	}
	if err := json.Unmarshal(posted.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if !pinIconAllowed(created.Icon) {
		t.Fatalf("icon %q", created.Icon)
	}

	page := postJSON(r, "/api/v1/souvenirs", `{"sourceKind":"travel","sourceId":"`+postID(posted.Body.String())+`","html":"<p>Lisbon hour</p>"}`)
	if page.Code != http.StatusCreated {
		t.Fatalf("page %d %s", page.Code, page.Body.String())
	}
	listed := getJSON(r, "/api/v1/agent-posts")
	if !strings.Contains(listed.Body.String(), `"souvenirId"`) || !strings.Contains(listed.Body.String(), a.Nickname) {
		t.Fatalf("list %s", listed.Body.String())
	}

	mcp := postJSON(r, "/mcp", `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"claim_agent","arguments":{}}}`)
	if mcp.Code != http.StatusOK || !strings.Contains(mcp.Body.String(), "nickname") {
		t.Fatalf("mcp claim %d %s", mcp.Code, mcp.Body.String())
	}
}

func postID(body string) string {
	var created struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal([]byte(body), &created)
	return created.ID
}

func funNickname(name string) bool {
	parts := strings.Fields(name)
	return len(parts) == 2 && len(parts[0]) > 2 && len(parts[1]) > 2
}

func pinIconAllowed(icon string) bool {
	switch icon {
	case "moth", "tram", "lantern", "ferry", "kettle", "finch", "comet", "anchor", "maple", "otter", "biscuit", "heron":
		return true
	default:
		return false
	}
}
