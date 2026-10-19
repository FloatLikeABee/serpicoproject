package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func claimAgentForContent(t *testing.T, r http.Handler) string {
	t.Helper()
	claimed := postJSON(r, "/api/v1/agents", `{}`)
	if claimed.Code != http.StatusCreated {
		t.Fatalf("claim %d: %s", claimed.Code, claimed.Body.String())
	}
	var ident struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(claimed.Body.Bytes(), &ident); err != nil {
		t.Fatal(err)
	}
	if ident.ID == "" {
		t.Fatal("claim returned no id")
	}
	return ident.ID
}

func TestAgentContentHTTPPublishesSearchesGetsAndDownloadsSkill(t *testing.T) {
	resetAgentContentLimiter()
	resetAgentClaimLimiter()
	r, _ := hardDataTestRouter(t)
	agentID := claimAgentForContent(t, r)

	beforeFleet := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	created := postJSON(r, "/api/v1/agent-content", `{
		"kind":"skill",
		"agentId":"`+agentID+`",
		"authorName":"Map Team",
		"title":"Route Mapper",
		"summary":"Compare safe routes",
		"body":"# Route mapper\n\nUse this process.",
		"tags":["Go","mapping"]
	}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create %d: %s", created.Code, created.Body.String())
	}
	var skill struct {
		ID            string   `json:"id"`
		Kind          string   `json:"kind"`
		AgentID       string   `json:"agentId"`
		AgentName     string   `json:"agentName"`
		AuthorName    string   `json:"authorName"`
		Tags          []string `json:"tags"`
		SkillMarkdown string   `json:"skillMarkdown"`
		DownloadURL   string   `json:"downloadUrl"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &skill); err != nil {
		t.Fatal(err)
	}
	if skill.ID == "" || skill.Kind != "skill" || skill.AgentID != agentID || skill.AgentName == "" || skill.AuthorName != "Map Team" {
		t.Fatalf("created: %+v", skill)
	}
	if len(skill.Tags) != 2 || !strings.Contains(skill.SkillMarkdown, "name: route-mapper") || skill.DownloadURL == "" {
		t.Fatalf("portable skill missing: %+v", skill)
	}

	search := getJSON(r, "/api/v1/agent-content?kind=skill&kind=experience&q=route&author="+url.QueryEscape("MAP TEAM")+"&tag=mapping")
	if search.Code != http.StatusOK {
		t.Fatalf("search %d: %s", search.Code, search.Body.String())
	}
	var result struct {
		Items []struct {
			ID      string   `json:"id"`
			Kind    string   `json:"kind"`
			Excerpt string   `json:"excerpt"`
			Tags    []string `json:"tags"`
		} `json:"items"`
		NextCursor string `json:"nextCursor"`
	}
	if err := json.Unmarshal(search.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].ID != skill.ID || result.Items[0].Kind != "skill" || result.Items[0].Excerpt != "Compare safe routes" {
		t.Fatalf("search result: %+v", result)
	}

	detail := getJSON(r, "/api/v1/agent-content/"+skill.ID)
	if detail.Code != http.StatusOK || !strings.Contains(detail.Body.String(), `"body":"# Route mapper`) {
		t.Fatalf("detail %d: %s", detail.Code, detail.Body.String())
	}
	download := getJSON(r, "/api/v1/agent-content/"+skill.ID+"/download")
	if download.Code != http.StatusOK {
		t.Fatalf("download %d: %s", download.Code, download.Body.String())
	}
	if got := download.Header().Get("Content-Type"); got != "text/markdown; charset=utf-8" {
		t.Fatalf("content type %q", got)
	}
	if got := download.Header().Get("Content-Disposition"); got != `attachment; filename="route-mapper-SKILL.md"` {
		t.Fatalf("disposition %q", got)
	}
	if download.Body.String() != skill.SkillMarkdown {
		t.Fatalf("download differs\n%s\n%s", download.Body.String(), skill.SkillMarkdown)
	}

	afterFleet := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	if afterFleet.Body.String() != beforeFleet.Body.String() {
		t.Fatalf("publishing changed fleet\nbefore %s\nafter %s", beforeFleet.Body.String(), afterFleet.Body.String())
	}
}

func TestAgentContentHTTPRejectsInvalidPublicationSearchAndDownload(t *testing.T) {
	resetAgentContentLimiter()
	resetAgentClaimLimiter()
	r, _ := hardDataTestRouter(t)
	agentID := claimAgentForContent(t, r)

	unknown := postJSON(r, "/api/v1/agent-content", `{
		"kind":"skill","agentId":"unknown","authorName":"A","title":"T","summary":"S","body":"B"
	}`)
	if unknown.Code != http.StatusBadRequest {
		t.Fatalf("unknown claim %d: %s", unknown.Code, unknown.Body.String())
	}
	missing := postJSON(r, "/api/v1/agent-content", `{"kind":"skill"}`)
	if missing.Code != http.StatusBadRequest {
		t.Fatalf("missing fields %d: %s", missing.Code, missing.Body.String())
	}

	experience := postJSON(r, "/api/v1/agent-content", `{
		"kind":"experience","agentId":"`+agentID+`","authorName":"A","title":"Shift","summary":"S","body":"B"
	}`)
	if experience.Code != http.StatusCreated {
		t.Fatalf("experience %d: %s", experience.Code, experience.Body.String())
	}
	var made struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(experience.Body.Bytes(), &made); err != nil {
		t.Fatal(err)
	}
	notSkill := getJSON(r, "/api/v1/agent-content/"+made.ID+"/download")
	if notSkill.Code != http.StatusNotFound {
		t.Fatalf("experience download %d: %s", notSkill.Code, notSkill.Body.String())
	}
	missingDetail := getJSON(r, "/api/v1/agent-content/missing")
	if missingDetail.Code != http.StatusNotFound {
		t.Fatalf("missing detail %d: %s", missingDetail.Code, missingDetail.Body.String())
	}

	badQueries := []string{
		"/api/v1/agent-content?limit=51",
		"/api/v1/agent-content?limit=nope",
		"/api/v1/agent-content?kind=wrong",
		"/api/v1/agent-content?cursor=not-a-cursor",
		"/api/v1/agent-content?q=" + strings.Repeat("q", 201),
	}
	for _, path := range badQueries {
		w := getJSON(r, path)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("%s status %d: %s", path, w.Code, w.Body.String())
		}
	}
}

func TestAgentContentHTTPUsesOneSixPerHourLimit(t *testing.T) {
	resetAgentContentLimiter()
	resetAgentClaimLimiter()
	r, _ := hardDataTestRouter(t)
	agentID := claimAgentForContent(t, r)
	for i := 0; i < 6; i++ {
		w := postJSON(r, "/api/v1/agent-content", `{
			"kind":"experience","agentId":"`+agentID+`","authorName":"A",
			"title":"Shift `+string(rune('A'+i))+`","summary":"S","body":"B"
		}`)
		if w.Code != http.StatusCreated {
			t.Fatalf("publication %d status %d: %s", i, w.Code, w.Body.String())
		}
	}
	limited := postJSON(r, "/api/v1/agent-content", `{
		"kind":"experience","agentId":"`+agentID+`","authorName":"A",
		"title":"Seventh","summary":"S","body":"B"
	}`)
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("seventh status %d: %s", limited.Code, limited.Body.String())
	}
}
