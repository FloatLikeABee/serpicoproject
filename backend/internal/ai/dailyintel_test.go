package ai

import "testing"

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
