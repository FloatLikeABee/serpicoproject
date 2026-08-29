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

func TestBuildChatPromptChineseWhenInterviewNationCN(t *testing.T) {
	prompt := BuildChatPrompt(
		"案情简介：上海分尸案",
		"suspect-interview\n[nation:cn]",
		nil, nil, "", "",
	)
	if !strings.Contains(prompt, "简体中文") {
		t.Fatal("interview CN prompt must require Simplified Chinese")
	}
}
