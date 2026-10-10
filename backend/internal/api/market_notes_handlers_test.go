package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func twelvePoints() string {
	parts := make([]string, 0, 12)
	for i := 1; i <= 12; i++ {
		parts = append(parts, `{"t":"2026-10-`+two(i)+`","v":`+itoa(100+i)+`}`)
	}
	return "[" + strings.Join(parts, ",") + "]"
}

func two(n int) string {
	if n < 10 {
		return "0" + itoa(n)
	}
	return itoa(n)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	digits := []byte{}
	for n > 0 {
		digits = append([]byte{byte('0' + n%10)}, digits...)
		n /= 10
	}
	return string(digits)
}

func TestMarketNoteStoresETFSeriesAndPolicyBeats(t *testing.T) {
	resetMarketNoteLimiter()
	r := fleetTestRouter(t)
	tape := `{
		"agentName":"Grok","title":"SPY week","body":"The tape firmed.\n\nThe last print is the check.",
		"kind":"tape","region":"us","instrumentKind":"etf","symbol":"SPY",
		"stance":"firmer","horizon":"weeks","points":` + twelvePoints() + `
	}`
	created := postJSON(r, "/api/v1/market-notes", tape)
	if created.Code != http.StatusCreated {
		t.Fatalf("tape %d: %s", created.Code, created.Body.String())
	}
	if !strings.Contains(created.Body.String(), `"symbol":"SPY"`) || !strings.Contains(created.Body.String(), `"stance":"firmer"`) {
		t.Fatalf("created %s", created.Body.String())
	}

	policy := `{
		"agentName":"Grok","title":"Rate path","body":"The desk is watching the statement.",
		"kind":"policy","region":"cn",
		"beats":[{"date":"2026-09-01","text":"Statement"},{"date":"2026-10-01","text":"Follow-up"}]
	}`
	policyRes := postJSON(r, "/api/v1/market-notes", policy)
	if policyRes.Code != http.StatusCreated {
		t.Fatalf("policy %d: %s", policyRes.Code, policyRes.Body.String())
	}

	listed := getJSON(r, "/api/v1/market-notes")
	if listed.Code != http.StatusOK {
		t.Fatalf("list %d: %s", listed.Code, listed.Body.String())
	}
	var body struct {
		Notes []struct {
			Kind   string `json:"kind"`
			Symbol string `json:"symbol"`
			Stance string `json:"stance"`
			Points []struct {
				T string  `json:"t"`
				V float64 `json:"v"`
			} `json:"points"`
			Beats []struct {
				Date string `json:"date"`
				Text string `json:"text"`
			} `json:"beats"`
		} `json:"notes"`
	}
	if err := json.Unmarshal(listed.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	var etf, pol bool
	for _, note := range body.Notes {
		if note.Kind == "tape" && note.Symbol == "SPY" && note.Stance == "firmer" && len(note.Points) == 12 && note.Points[0].V == 101 && note.Points[11].V == 112 {
			etf = true
		}
		if note.Kind == "policy" && len(note.Beats) == 2 && note.Beats[0].Date == "2026-09-01" && len(note.Points) == 0 {
			pol = true
		}
	}
	if !etf || !pol {
		t.Fatalf("notes %+v", body.Notes)
	}

	refusals := []string{
		`{"agentName":"Grok","title":"Empty","body":"   ","kind":"tape","region":"us","instrumentKind":"etf","symbol":"SPY","stance":"watch","horizon":"days","points":[{"t":"2026-10-01","v":1},{"t":"2026-10-02","v":2}]}`,
		`{"agentName":"Grok","title":"No tape","body":"missing points","kind":"tape","region":"us","instrumentKind":"stock","symbol":"AAPL","stance":"watch","horizon":"days","points":[]}`,
		`{"agentName":"Grok","title":"Buy","body":"not advice","kind":"tape","region":"us","instrumentKind":"stock","symbol":"AAPL","stance":"buy","horizon":"days","points":[{"t":"2026-10-01","v":1},{"t":"2026-10-02","v":2}]}`,
		`{"agentName":"Grok","title":"No beats","body":"policy without dates","kind":"policy","region":"global","beats":[]}`,
	}
	before := getJSON(r, "/api/v1/market-notes")
	for _, raw := range refusals {
		got := postJSON(r, "/api/v1/market-notes", raw)
		if got.Code != http.StatusBadRequest {
			t.Fatalf("refusal %d: %s\n%s", got.Code, got.Body.String(), raw)
		}
	}
	after := getJSON(r, "/api/v1/market-notes")
	if after.Body.String() != before.Body.String() {
		t.Fatalf("refusals added a note\n%s", after.Body.String())
	}
}

func TestMarketNoteRateLimitLeavesOfficerTablesUntouched(t *testing.T) {
	resetMarketNoteLimiter()
	r, db := hardDataTestRouter(t)
	beforeFleet := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	beforeCounts := tableCounts(t, db.SQLite)
	ok := `{"agentName":"Grok","title":"Watch","body":"one note","kind":"trend","region":"global","beats":[{"date":"2026-10-01","text":"Open"}]}`
	for i := 0; i < 12; i++ {
		got := postJSON(r, "/api/v1/market-notes", ok)
		if got.Code != http.StatusCreated {
			t.Fatalf("note %d status %d: %s", i, got.Code, got.Body.String())
		}
	}
	limited := postJSON(r, "/api/v1/market-notes", ok)
	if limited.Code != http.StatusTooManyRequests {
		t.Fatalf("13th note %d: %s", limited.Code, limited.Body.String())
	}
	afterFleet := getJSON(r, "/api/v1/fleet/markers?userId=demo-serpico")
	if afterFleet.Body.String() != beforeFleet.Body.String() {
		t.Fatalf("fleet changed\n%s", afterFleet.Body.String())
	}
	afterCounts := tableCounts(t, db.SQLite)
	for name, count := range afterCounts {
		if name == "market_notes" {
			if count != beforeCounts[name]+12 {
				t.Fatalf("market_notes %d -> %d", beforeCounts[name], count)
			}
			continue
		}
		if count != beforeCounts[name] {
			t.Fatalf("table %s changed %d -> %d", name, beforeCounts[name], count)
		}
	}
}

func TestMCPMarketNoteShowsOnTheDesk(t *testing.T) {
	resetMarketNoteLimiter()
	r, db := hardDataTestRouter(t)
	MountMCP(r, db)
	mcp := postJSON(r, "/mcp", `{
		"jsonrpc":"2.0","id":4,"method":"tools/call",
		"params":{"name":"post_market_note","arguments":{
			"agentName":"Grok","title":"From MCP","body":"mcp tape",
			"kind":"tape","region":"cn","instrumentKind":"index","symbol":"000001.SS",
			"stance":"watch","horizon":"days",
			"points":[{"t":"2026-10-01","v":3},{"t":"2026-10-02","v":4}]
		}}
	}`)
	if mcp.Code != http.StatusOK || strings.Contains(mcp.Body.String(), `"isError":true`) || !strings.Contains(mcp.Body.String(), "From MCP") {
		t.Fatalf("mcp %d: %s", mcp.Code, mcp.Body.String())
	}
	listed := getJSON(r, "/api/v1/market-notes")
	if !strings.Contains(listed.Body.String(), "From MCP") || !strings.Contains(listed.Body.String(), "000001.SS") {
		t.Fatalf("list %s", listed.Body.String())
	}
}

func tableCounts(t *testing.T, db *sql.DB) map[string]int {
	t.Helper()
	rows, err := db.Query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	names := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatal(err)
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	rows.Close()
	out := map[string]int{}
	for _, name := range names {
		var n int
		if err := db.QueryRow(`SELECT COUNT(*) FROM "` + name + `"`).Scan(&n); err != nil {
			t.Fatal(err)
		}
		out[name] = n
	}
	return out
}
