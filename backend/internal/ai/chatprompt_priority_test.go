package ai

import (
	"strings"
	"testing"
)

func TestBuildChatPromptAdminSourcesBeforeWeb(t *testing.T) {
	prompt := BuildChatPrompt(
		"Any recent cold case news?",
		"mysteries",
		nil,
		[]RAGDocument{{
			ID:       "rag-intel-1",
			Title:    "Solved cold case lesson",
			Content:  "Genetic genealogy broke the case.",
			Category: "history",
			Tags:     []string{"auto_intel", "knowledge"},
		}},
		"Supplemental headlines (not admin-curated):\n1. Random web hit\n",
		"### PRIORITY 1 — Admin news digests (Markdown from backstage collection)\n**Brief**\n",
	)

	adminRAG := strings.Index(prompt, "PRIORITY 1 — Admin knowledge base")
	adminMD := strings.Index(prompt, "PRIORITY 1 — Admin news digests")
	web := strings.Index(prompt, "PRIORITY 2 — Supplemental web search")
	if adminRAG < 0 || adminMD < 0 || web < 0 {
		t.Fatalf("missing sections: rag=%d md=%d web=%d", adminRAG, adminMD, web)
	}
	if !(adminRAG < adminMD && adminMD < web) {
		t.Fatalf("bad priority order: rag=%d md=%d web=%d", adminRAG, adminMD, web)
	}
	if !strings.Contains(prompt, "Prefer admin-curated RAG and digests over web search") {
		t.Fatal("missing closing priority instruction")
	}
	if !strings.Contains(prompt, "admin-collection") {
		t.Fatal("expected auto_intel docs labeled admin-collection")
	}
}

func TestRAGSearchBoostsAutoIntel(t *testing.T) {
	db := &RAGDatabase{
		documents: []RAGDocument{
			{
				ID:       "seed",
				Title:    "Generic note",
				Content:  "cold case mention",
				Category: "history",
				Tags:     []string{"history"},
			},
			{
				ID:       "admin",
				Title:    "Admin collected cold case",
				Content:  "cold case genealogy lesson",
				Category: "history",
				Tags:     []string{"auto_intel", "knowledge"},
			},
		},
	}
	results := db.Search("cold case", 2)
	if len(results) == 0 {
		t.Fatal("expected results")
	}
	if results[0].ID != "admin" {
		t.Fatalf("expected auto_intel first, got %s", results[0].ID)
	}
}
