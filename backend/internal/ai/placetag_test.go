package ai

import (
	"strings"
	"testing"
)

func nycPlaceMessage() string {
	return strings.Join([]string{
		"MAP PIN FIELD BRIEF — answer only about this pin.",
		"PIN TYPE: Personnel",
		"NAME: Tom Bind",
		"COORDINATES: 40.734, -73.984",
		"ADDRESS: 358 East 19th Street, New York, New York",
		"CITY / JURISDICTION: New York, New York",
		"OFFICER NOTES: Walked around suspiciously and left very fast",
	}, "\n")
}

func olathePlaceMessage() string {
	return strings.Join([]string{
		"MAP PIN FIELD BRIEF — answer only about this pin.",
		"PIN TYPE: Personnel",
		"NAME: Unit 12",
		"COORDINATES: 38.881, -94.819",
		"ADDRESS: 100 E Santa Fe St, Olathe, Kansas",
		"CITY / JURISDICTION: Olathe, Kansas",
		"OFFICER NOTES: Subject left the station lot",
	}, "\n")
}

func olatheCrimeDoc() RAGDocument {
	return RAGDocument{
		ID:       "rag-001",
		Title:    "Olathe Crime Statistics 2023",
		Content:  "Olathe PD reported 1,234 total crimes in 2023. High-crime areas include Downtown Olathe (S Kansas Ave), North Olathe (N Ridgeview Rd), and East Olathe (E 151st St).",
		Category: "crime_stats",
		Location: "Olathe, KS",
		Tags:     []string{"statistics", "crime", "olathe", "2023"},
	}
}

func TestFilterRAGDocsForPlace_DropsOlatheOnNYCPin(t *testing.T) {
	docs := []RAGDocument{
		olatheCrimeDoc(),
		{
			ID:       "rag-nyc",
			Title:    "NYC precinct note",
			Content:  "14th Street corridor theft pattern.",
			Category: "crime_stats",
			Location: "New York, NY",
			Tags:     []string{"nyc"},
		},
	}
	got := filterRAGDocsForPlace(docs, nycPlaceMessage())
	if len(got) != 1 || got[0].ID != "rag-nyc" {
		t.Fatalf("expected only NYC doc, got %#v", got)
	}
}

func TestFilterRAGDocsForPlace_KeepsOlatheOnOlathePin(t *testing.T) {
	got := filterRAGDocsForPlace([]RAGDocument{olatheCrimeDoc()}, olathePlaceMessage())
	if len(got) != 1 || got[0].ID != "rag-001" {
		t.Fatalf("expected Olathe doc for Olathe pin, got %#v", got)
	}
}

func TestBuildChatPromptPlaceTag_NYCDoesNotUseOlatheIdentityOrStats(t *testing.T) {
	prompt := BuildChatPrompt(
		nycPlaceMessage(),
		"in-pursue-place",
		nil,
		filterRAGDocsForPlace([]RAGDocument{olatheCrimeDoc()}, nycPlaceMessage()),
		"Supplemental headlines (not admin-curated):\n1. East Village NYPD patrol (local paper)\n",
		"### PRIORITY 1 — Admin news digests\nOlathe digest should not appear\n",
	)
	if strings.Contains(prompt, "assigned to the Olathe Police Department") {
		t.Fatal("place-tag prompt should not assign Serpico to Olathe PD")
	}
	if strings.Contains(prompt, "Olathe PD reported 1,234") {
		t.Fatal("NYC pin must not receive Olathe crime stats")
	}
	if strings.Contains(prompt, "Olathe digest should not appear") {
		t.Fatal("place-tag prompt must ignore news digests from other contexts")
	}
	if !strings.Contains(prompt, "358 East 19th Street") {
		t.Fatal("expected pin address in prompt")
	}
	if !strings.Contains(prompt, "East Village NYPD patrol") {
		t.Fatal("expected live search for this pin")
	}
	if strings.Contains(prompt, "Prefer admin-curated RAG and digests over web search") {
		t.Fatal("place-tag mode should not prefer unrelated admin RAG")
	}
}

func footPursuitDoc() RAGDocument {
	return RAGDocument{
		ID:       "rag-chase-003",
		Title:    "Foot Pursuit Operation Codex",
		Content:  "Foot pursuit protocol: 1) Announce foot pursuit on radio with direction of travel. 2) Primary pursuer must not enter blind alleys alone — hold containment. 3) K-9 request within first 2 minutes when available. 4) Perimeter units seal exits before interior entry. 5) Less-lethal and med standby for known armed subjects. 6) Document suspect description and discarded clothing/weapons.",
		Category: "chase-game",
		Location: "Olathe, KS",
		Tags:     []string{"chase", "game", "foot", "pursuit", "codex"},
	}
}

func TestFilterRAGDocsForPlace_DropsChaseGameEvenInOlathe(t *testing.T) {
	got := filterRAGDocsForPlace([]RAGDocument{footPursuitDoc(), olatheCrimeDoc()}, olathePlaceMessage())
	for _, doc := range got {
		if doc.ID == "rag-chase-003" || strings.Contains(doc.Content, "Foot pursuit protocol") {
			t.Fatalf("map pins must not use chase-game SOPs, got %#v", got)
		}
	}
	if len(got) != 1 || got[0].ID != "rag-001" {
		t.Fatalf("expected only Olathe crime stats through the filter helper, got %#v", got)
	}
}

func TestBuildChatPromptPlaceTag_OlathePinDoesNotPasteFootPursuit(t *testing.T) {
	docs := filterRAGDocsForPlace([]RAGDocument{footPursuitDoc(), olatheCrimeDoc()}, olathePlaceMessage())
	prompt := BuildChatPrompt(olathePlaceMessage(), "in-pursue-place", nil, docs, "", "")
	if strings.Contains(prompt, "Foot pursuit protocol") {
		t.Fatal("place-tag prompt must not include foot pursuit SOP")
	}
	if !strings.Contains(prompt, "Do not mention Olathe or Kansas unless that is the pin address") {
		t.Fatal("expected geographic closing instruction")
	}
}

func TestPlaceTagFallbackNeverDumpsFootPursuitCodex(t *testing.T) {
	s := &AIService{}
	out := s.generateFallbackResponse(olathePlaceMessage(), []RAGDocument{footPursuitDoc()}, "in-pursue-place", "")
	if strings.Contains(out, "Foot pursuit protocol") {
		t.Fatalf("fallback pasted chase-game SOP: %s", out)
	}
	if strings.Contains(out, "Here's what I pulled from department records") {
		t.Fatalf("place-tag fallback must not dump department records: %s", out)
	}
	if !strings.Contains(out, "Unit 12") {
		t.Fatalf("fallback should use the pin name, got %s", out)
	}
	if !strings.Contains(out, "Olathe") {
		t.Fatalf("fallback should use the pin city, got %s", out)
	}
	if !strings.Contains(out, "Subject left the station lot") {
		t.Fatalf("fallback should use officer notes, got %s", out)
	}
}

func TestPlaceTagFallbackDoesNotDumpUnrelatedRAG(t *testing.T) {
	s := &AIService{}
	out := s.generateFallbackResponse(nycPlaceMessage(), nil, "in-pursue-place", "")
	if strings.Contains(out, "Olathe") {
		t.Fatalf("fallback for NYC pin leaked Olathe: %s", out)
	}
	if strings.Contains(out, "Foot pursuit protocol") {
		t.Fatalf("fallback for NYC pin leaked chase SOP: %s", out)
	}
	if !strings.Contains(out, "New York") {
		t.Fatalf("fallback should mention the pin city, got %s", out)
	}
	if !strings.Contains(out, "Tom Bind") {
		t.Fatalf("fallback should mention the pin name, got %s", out)
	}

	general := s.generateFallbackResponse("crime stats?", []RAGDocument{olatheCrimeDoc()}, "in-pursue", "")
	if !strings.Contains(general, "Olathe PD reported 1,234") {
		t.Fatal("non-place fallback should still dump matching department records")
	}
}

func TestPlaceTagWebQueryUsesAddressNotContextSlug(t *testing.T) {
	q := placeTagWebQuery(nycPlaceMessage())
	if !strings.Contains(strings.ToLower(q), "east 19th") {
		t.Fatalf("expected address in search query, got %q", q)
	}
	if !strings.Contains(strings.ToLower(q), "new york") {
		t.Fatalf("expected city in search query, got %q", q)
	}
	if strings.Contains(q, "in-pursue-place") {
		t.Fatalf("search query should not include context slug, got %q", q)
	}
	if strings.Contains(strings.ToLower(q), "olathe") {
		t.Fatalf("NYC pin search must not include Olathe, got %q", q)
	}
}
