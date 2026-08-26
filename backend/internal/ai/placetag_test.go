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

func TestBuildChatPromptPlaceTag_OlathePinCanUseMatchingRAG(t *testing.T) {
	docs := filterRAGDocsForPlace([]RAGDocument{olatheCrimeDoc()}, olathePlaceMessage())
	prompt := BuildChatPrompt(olathePlaceMessage(), "in-pursue-place", nil, docs, "", "")
	if !strings.Contains(prompt, "Olathe PD reported 1,234") {
		t.Fatal("Olathe pin should still receive matching department records")
	}
	if !strings.Contains(prompt, "Do not mention Olathe or Kansas unless that is the pin address") {
		t.Fatal("expected geographic closing instruction")
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

func TestPlaceTagFallbackDoesNotDumpUnrelatedRAG(t *testing.T) {
	s := &AIService{}
	out := s.generateFallbackResponse(nycPlaceMessage(), nil, "in-pursue-place")
	if strings.Contains(out, "Olathe") {
		t.Fatalf("fallback for NYC pin leaked Olathe: %s", out)
	}
	if !strings.Contains(out, "New York") {
		t.Fatalf("fallback should mention the pin city, got %s", out)
	}

	general := s.generateFallbackResponse("crime stats?", []RAGDocument{olatheCrimeDoc()}, "in-pursue")
	if !strings.Contains(general, "Olathe PD reported 1,234") {
		t.Fatal("non-place fallback should still dump matching department records")
	}
}
