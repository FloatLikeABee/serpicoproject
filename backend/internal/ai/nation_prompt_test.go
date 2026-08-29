package ai

import (
	"strings"
	"testing"
)

func TestBuildChatPromptChineseWhenNationCN(t *testing.T) {
	prompt := BuildChatPrompt(
		"最近有什么案件？",
		"general\n[nation:cn]",
		nil, nil, "", "",
	)
	if !strings.Contains(prompt, "简体中文") {
		t.Fatal("expected Simplified Chinese reply instruction")
	}
}

func TestBuildChatPromptEnglishWhenUS(t *testing.T) {
	prompt := BuildChatPrompt("What are recent cases?", "general", nil, nil, "", "")
	if strings.Contains(prompt, "简体中文") {
		t.Fatal("US prompt should not require Chinese")
	}
}

func TestPlaceTagPromptChineseWhenNationCN(t *testing.T) {
	p := PlaceTagLanguageSuffix("cn")
	if !strings.Contains(p, "简体中文") {
		t.Fatal("place tag CN suffix")
	}
}
