package ai

import (
	"encoding/json"
	"testing"
)

func TestLooksLikeKnowledge(t *testing.T) {
	if !looksLikeKnowledge("Cold case solved after DNA breakthrough taught investigators new methods") {
		t.Fatal("expected knowledge")
	}
	if looksLikeKnowledge("Local team wins championship game overnight") {
		t.Fatal("expected non-knowledge")
	}
}

func TestSlugify(t *testing.T) {
	got := slugify("Cold Case Solved!!! in New York")
	if got == "" {
		t.Fatal("empty slug")
	}
	if got != "cold-case-solved-in-new-york" {
		t.Fatalf("got %q", got)
	}
}

func TestNormalizeTitle(t *testing.T) {
	a := normalizeTitle("  Hello   World ")
	b := normalizeTitle("hello world")
	if a != b {
		t.Fatalf("%q != %q", a, b)
	}
}

func TestSanitizeModelJSONEscapesNewlinesInStrings(t *testing.T) {
	raw := "```json\n{\n  \"items\": [\n    {\n      \"source_index\": 16,\n      \"kind\": \"knowledge\",\n      \"title\": \"Genetic genealogy helps solve Arlington killing\",\n      \"location\": \"Arlington, Texas\",\n      \"category\": \"history\",\n      \"summary_md\": \"Line one\nLine two\",\n      \"rag_content\": \"Fact one\nFact two\"\n    }\n  ]\n}\n```"
	got := sanitizeModelJSON(raw)
	var parsed intelPickResponse
	if err := json.Unmarshal([]byte(got), &parsed); err != nil {
		t.Fatalf("unmarshal failed: %v\njson=%s", err, got)
	}
	if len(parsed.Items) != 1 {
		t.Fatalf("items=%d", len(parsed.Items))
	}
	if parsed.Items[0].SourceIndex != 16 {
		t.Fatalf("source_index=%d", parsed.Items[0].SourceIndex)
	}
	if parsed.Items[0].SummaryMD != "Line one\nLine two" {
		t.Fatalf("summary=%q", parsed.Items[0].SummaryMD)
	}
}

func TestParseIntelPicks(t *testing.T) {
	raw := "Here you go:\n```json\n{\"items\":[{\"source_index\":1,\"kind\":\"news\",\"title\":\"t\",\"location\":\"\",\"category\":\"history\",\"summary_md\":\"- a\\n- b\",\"rag_content\":\"\"}]}\n```"
	parsed, err := parseIntelPicks(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Items) != 1 || parsed.Items[0].Kind != "news" {
		t.Fatalf("%+v", parsed)
	}
}
