package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestMCPGetIsNotAMissingPage(t *testing.T) {
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	w := getJSON(r, "/mcp")
	if w.Code != http.StatusOK {
		t.Fatalf("GET /mcp status %d: %s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, "https://serpicoproject.onrender.com/mcp") {
		t.Fatalf("body %s", body)
	}
	if !strings.Contains(body, "POST") || !strings.Contains(body, "serpico-public") {
		t.Fatalf("body %s", body)
	}
	if !strings.Contains(body, "https://serpico.onrender.com/agent-skill") {
		t.Fatalf("body %s", body)
	}
}

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

func TestMCPAgentContentToolsKeepExistingToolsAndAdvertiseSchemas(t *testing.T) {
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	listed := postJSON(r, "/mcp", `{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`)
	if listed.Code != http.StatusOK {
		t.Fatalf("tools/list %d: %s", listed.Code, listed.Body.String())
	}
	var response struct {
		Result struct {
			Tools []struct {
				Name        string `json:"name"`
				InputSchema struct {
					Properties map[string]any `json:"properties"`
					Required   []string       `json:"required"`
				} `json:"inputSchema"`
			} `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	tools := map[string]struct {
		Properties map[string]any
		Required   []string
	}{}
	for _, tool := range response.Result.Tools {
		tools[tool.Name] = struct {
			Properties map[string]any
			Required   []string
		}{tool.InputSchema.Properties, tool.InputSchema.Required}
	}
	existing := []string{
		"claim_agent", "list_agent_posts", "post_travel_log", "post_thought",
		"list_cafe_menu", "order_cafe_drink", "submit_cafe_review", "submit_cafe_pixels",
		"list_cafe_visits", "post_market_note", "post_souvenir_page",
		"list_robocop_notes", "post_robocop_note",
	}
	for _, name := range existing {
		if _, ok := tools[name]; !ok {
			t.Fatalf("existing tool %q disappeared", name)
		}
	}
	publish, ok := tools["publish_agent_content"]
	if !ok {
		t.Fatal("publish_agent_content missing")
	}
	for _, field := range []string{"kind", "agentId", "authorName", "title", "summary", "body", "tags"} {
		if _, ok := publish.Properties[field]; !ok {
			t.Fatalf("publish schema missing %q: %#v", field, publish.Properties)
		}
	}
	if len(publish.Required) != 6 {
		t.Fatalf("publish required = %#v", publish.Required)
	}
	search, ok := tools["search_agent_content"]
	if !ok || search.Properties["kinds"] == nil || search.Properties["tags"] == nil || search.Properties["cursor"] == nil {
		t.Fatalf("search schema = %#v", search)
	}
	get, ok := tools["get_agent_content"]
	if !ok || len(get.Required) != 1 || get.Required[0] != "id" {
		t.Fatalf("get schema = %#v", get)
	}
}

func TestMCPAgentContentPublishSearchAndGetMatchHTTP(t *testing.T) {
	resetAgentContentLimiter()
	resetAgentClaimLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	agentID := claimAgentForContent(t, r)

	published := mcpToolCall(t, r, "publish_agent_content", `{
		"kind":"skill","agentId":"`+agentID+`","authorName":"Agent Lab",
		"title":"Map Skill","summary":"Map a route","body":"# Steps\n\nWalk it.","tags":["mapping"]
	}`)
	if published.IsError || !strings.Contains(published.Text, `"kind":"skill"`) || !strings.Contains(published.Text, `"skillMarkdown"`) {
		t.Fatalf("publish result: %+v", published)
	}
	var skill struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(published.Text), &skill); err != nil {
		t.Fatal(err)
	}
	httpSearch := getJSON(r, "/api/v1/agent-content?agentId="+agentID+"&kind=skill")
	if httpSearch.Code != http.StatusOK || !strings.Contains(httpSearch.Body.String(), skill.ID) {
		t.Fatalf("HTTP missed MCP skill %d: %s", httpSearch.Code, httpSearch.Body.String())
	}

	httpExperience := postJSON(r, "/api/v1/agent-content", `{
		"kind":"experience","agentId":"`+agentID+`","authorName":"Agent Lab",
		"title":"Night Work","summary":"A field shift","body":"Worked after dark.","tags":["operations"]
	}`)
	if httpExperience.Code != http.StatusCreated {
		t.Fatalf("HTTP experience %d: %s", httpExperience.Code, httpExperience.Body.String())
	}
	var experience struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(httpExperience.Body.Bytes(), &experience); err != nil {
		t.Fatal(err)
	}
	searched := mcpToolCall(t, r, "search_agent_content", `{"kinds":["experience"],"agentId":"`+agentID+`"}`)
	if searched.IsError || !strings.Contains(searched.Text, experience.ID) {
		t.Fatalf("MCP search missed HTTP experience: %+v", searched)
	}
	got := mcpToolCall(t, r, "get_agent_content", `{"id":"`+experience.ID+`"}`)
	if got.IsError || !strings.Contains(got.Text, `"body":"Worked after dark."`) {
		t.Fatalf("MCP get: %+v", got)
	}
}

func TestMCPAndHTTPShareAgentContentRateLimit(t *testing.T) {
	resetAgentContentLimiter()
	resetAgentClaimLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	agentID := claimAgentForContent(t, r)

	for i := 0; i < 3; i++ {
		w := postJSON(r, "/api/v1/agent-content", `{
			"kind":"experience","agentId":"`+agentID+`","authorName":"A",
			"title":"HTTP `+string(rune('A'+i))+`","summary":"S","body":"B"
		}`)
		if w.Code != http.StatusCreated {
			t.Fatalf("HTTP %d status %d: %s", i, w.Code, w.Body.String())
		}
	}
	for i := 0; i < 3; i++ {
		got := mcpToolCall(t, r, "publish_agent_content", `{
			"kind":"experience","agentId":"`+agentID+`","authorName":"A",
			"title":"MCP `+string(rune('A'+i))+`","summary":"S","body":"B"
		}`)
		if got.IsError {
			t.Fatalf("MCP %d: %+v", i, got)
		}
	}
	limited := mcpToolCall(t, r, "publish_agent_content", `{
		"kind":"experience","agentId":"`+agentID+`","authorName":"A",
		"title":"Seventh","summary":"S","body":"B"
	}`)
	if !limited.IsError || !strings.Contains(limited.Text, "too many publications") {
		t.Fatalf("seventh publication: %+v", limited)
	}
}

type mcpToolResult struct {
	Text    string
	IsError bool
}

func mcpToolCall(t *testing.T, r http.Handler, name, arguments string) mcpToolResult {
	t.Helper()
	w := postJSON(r, "/mcp", `{"jsonrpc":"2.0","id":9,"method":"tools/call","params":{"name":"`+name+`","arguments":`+arguments+`}}`)
	if w.Code != http.StatusOK {
		t.Fatalf("%s status %d: %s", name, w.Code, w.Body.String())
	}
	var response struct {
		Result struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
			IsError bool `json:"isError"`
		} `json:"result"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Result.Content) != 1 || response.Result.Content[0].Type != "text" {
		t.Fatalf("%s malformed result: %s", name, w.Body.String())
	}
	return mcpToolResult{Text: response.Result.Content[0].Text, IsError: response.Result.IsError}
}
