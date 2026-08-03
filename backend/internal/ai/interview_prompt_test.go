package ai

import (
	"strings"
	"testing"
)

func TestSuspectInterviewPromptInjected(t *testing.T) {
	prompt := BuildChatPrompt(
		"Suspect said: I was home. My thoughts: vague.",
		"suspect-interview",
		nil,
		nil,
		"",
		"",
	)
	if !strings.Contains(prompt, "Suspect Interview Helper") {
		t.Fatal("expected interview helper mode in prompt")
	}
	if !strings.Contains(prompt, "Ask next (primary)") {
		t.Fatal("expected structured interview response format")
	}
	if !strings.Contains(prompt, "Strategic Use of Evidence") {
		t.Fatal("expected SUE technique guidance")
	}
	if strings.Contains(prompt, "Prefer admin-curated RAG and digests over web search") {
		t.Fatal("interview mode should use interview closing instruction")
	}
}
