package api

import "testing"

func TestParseAssistJSON_plainStrings(t *testing.T) {
	event, analysis := parseAssistJSON(
		`{"event":"Suspect fled north","analysis":"Check nearby CCTV"}`,
		"", "",
	)
	if event != "Suspect fled north" {
		t.Fatalf("event=%q", event)
	}
	if analysis != "Check nearby CCTV" {
		t.Fatalf("analysis=%q", analysis)
	}
}

func TestParseAssistJSON_nestedAnalysisObject(t *testing.T) {
	raw := `{"event":"Door forced","analysis":{"leads":"tool marks","gaps":"no witness","next_checks":"canvas block"}}`
	event, analysis := parseAssistJSON(raw, "", "")
	if event != "Door forced" {
		t.Fatalf("event=%q", event)
	}
	if analysis == "" || analysis[0] == '{' {
		t.Fatalf("expected plain analysis, got %q", analysis)
	}
	if !containsAll(analysis, "leads", "gaps") {
		t.Fatalf("analysis missing keys: %q", analysis)
	}
}

func TestParseAssistJSON_fencedAndProse(t *testing.T) {
	raw := "Here you go:\n```json\n{\"event\":\"Shot fired\",\"analysis\":\"Secure shell casing\"}\n```\n"
	event, analysis := parseAssistJSON(raw, "fallback", "")
	if event != "Shot fired" {
		t.Fatalf("event=%q", event)
	}
	if analysis != "Secure shell casing" {
		t.Fatalf("analysis=%q", analysis)
	}
}

func TestParseAssistJSON_analysisStoredAsJSONString(t *testing.T) {
	raw := `{"event":"Call received","analysis":"{\"summary\":\"Priority response\",\"leads\":\"caller ID\"}"}`
	_, analysis := parseAssistJSON(raw, "", "")
	if analysis == "" || analysis[0] == '{' {
		t.Fatalf("expected unwrapped analysis, got %q", analysis)
	}
}

func TestCleanAssistText_displayBlob(t *testing.T) {
	got := cleanAssistText(`{"leads":"plate match","gaps":"no video"}`)
	if got == "" || got[0] == '{' {
		t.Fatalf("expected flattened text, got %q", got)
	}
}

func containsAll(s string, parts ...string) bool {
	for _, p := range parts {
		if !containsFold(s, p) {
			return false
		}
	}
	return true
}

func containsFold(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(sub) == 0 ||
		(func() bool {
			for i := 0; i+len(sub) <= len(s); i++ {
				if equalFoldASCII(s[i:i+len(sub)], sub) {
					return true
				}
			}
			return false
		})())
}

func equalFoldASCII(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := 0; i < len(a); i++ {
		ca, cb := a[i], b[i]
		if ca >= 'A' && ca <= 'Z' {
			ca += 'a' - 'A'
		}
		if cb >= 'A' && cb <= 'Z' {
			cb += 'a' - 'A'
		}
		if ca != cb {
			return false
		}
	}
	return true
}
