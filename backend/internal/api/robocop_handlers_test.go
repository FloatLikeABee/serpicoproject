package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestRobocopNoteIsListedWithoutASessionAndLeavesFleetUntouched(t *testing.T) {
	r := fleetTestRouter(t)
	before := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	if before.Code != http.StatusOK {
		t.Fatalf("fleet before %d", before.Code)
	}

	created := postJSON(r, "/api/v1/robocop-notes", `{
		"agentName":"Amber Lark",
		"kind":"witness",
		"placeName":"Alfama stair",
		"lat":38.71,
		"lng":-9.13,
		"body":"A red sedan idled at the bottom of the stair."
	}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("create %d: %s", created.Code, created.Body.String())
	}
	var note struct {
		ID        string `json:"id"`
		PlaceName string `json:"placeName"`
		Body      string `json:"body"`
		AgentName string `json:"agentName"`
		Kind      string `json:"kind"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &note); err != nil || note.ID == "" || note.PlaceName != "Alfama stair" {
		t.Fatalf("created %s", created.Body.String())
	}

	listed := getJSON(r, "/api/v1/robocop-notes")
	if listed.Code != http.StatusOK {
		t.Fatalf("list %d: %s", listed.Code, listed.Body.String())
	}
	var body struct {
		Notes []struct {
			ID        string `json:"id"`
			PlaceName string `json:"placeName"`
			Kind      string `json:"kind"`
			AgentName string `json:"agentName"`
			Body      string `json:"body"`
		} `json:"notes"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Notes) != 1 || body.Notes[0].ID != note.ID || body.Notes[0].Kind != "witness" || body.Notes[0].Body != note.Body {
		t.Fatalf("notes %+v", body.Notes)
	}

	after := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	if after.Body.String() != before.Body.String() {
		t.Fatalf("fleet changed\nbefore %s\nafter %s", before.Body.String(), after.Body.String())
	}
}

func TestRobocopMCPPostThenList(t *testing.T) {
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	posted := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":1,"method":"tools/call",
		"params":{"name":"post_robocop_note","arguments":{"agentName":"Amber Lark","kind":"evidence","placeName":"Rua da Bica","lat":38.71,"lng":-9.14,"body":"A paper bag sat on the step."}}
	}`)
	if posted.Code != http.StatusOK || !strings.Contains(posted.Body.String(), "Rua da Bica") || !strings.Contains(posted.Body.String(), "paper bag") {
		t.Fatalf("post %d: %s", posted.Code, posted.Body.String())
	}
	listed := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":2,"method":"tools/call",
		"params":{"name":"list_robocop_notes","arguments":{}}
	}`)
	if listed.Code != http.StatusOK || !strings.Contains(listed.Body.String(), "Rua da Bica") || !strings.Contains(listed.Body.String(), "Amber Lark") || !strings.Contains(listed.Body.String(), "evidence") {
		t.Fatalf("list %d: %s", listed.Code, listed.Body.String())
	}
}
