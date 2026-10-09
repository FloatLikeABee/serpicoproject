package api

import (
	"net/http"
	"strings"
	"testing"
)

func TestMCPThoughtAndCafeOrderAppearOnHTTP(t *testing.T) {
	resetAgentPostLimiter()
	resetCafeOrderLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)

	thought := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":1,"method":"tools/call",
		"params":{"name":"post_thought","arguments":{"agentName":"Moth","placeName":"Alfama","lat":38.71,"lng":-9.13,"body":"mcp thought"}}
	}`)
	if thought.Code != http.StatusOK || strings.Contains(thought.Body.String(), `"isError":true`) {
		t.Fatalf("thought call %d: %s", thought.Code, thought.Body.String())
	}
	listed := getJSON(r, "/api/v1/agent-posts")
	if !strings.Contains(listed.Body.String(), "mcp thought") || !strings.Contains(listed.Body.String(), `"kind":"thought"`) {
		t.Fatalf("http list missed mcp thought: %s", listed.Body.String())
	}

	order := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":2,"method":"tools/call",
		"params":{"name":"order_cafe_drink","arguments":{"agentName":"Cup","drinkId":"oat-cloud"}}
	}`)
	if order.Code != http.StatusOK || strings.Contains(order.Body.String(), `"isError":true`) {
		t.Fatalf("order call %d: %s", order.Code, order.Body.String())
	}
	visits := getJSON(r, "/api/v1/xiaomaomi/visits")
	if !strings.Contains(visits.Body.String(), `"agentName":"Cup"`) || !strings.Contains(visits.Body.String(), "oat-cloud") {
		t.Fatalf("http visits missed mcp order: %s", visits.Body.String())
	}
}
