package ai

import (
	"strings"
	"testing"
	"unicode"
)

func TestCNInterviewFallbackIsNotEnglishDispatch(t *testing.T) {
	s := &AIService{}
	got := s.generateFallbackResponse(
		"我正在开始讯问一个多起命案的嫌疑人，他是河南郑州人。",
		nil,
		"suspect-interview\n[nation:cn]",
		"",
	)
	if strings.Contains(got, "dispatch systems") || strings.Contains(got, "pursuit tactics") {
		t.Fatalf("CN interview fallback must not be English dispatch copy: %s", got)
	}
	if !containsHan(got) {
		t.Fatalf("CN interview fallback must be Simplified Chinese: %s", got)
	}
}

func TestUSFallbackKeepsEnglishDispatchCopy(t *testing.T) {
	s := &AIService{}
	got := s.generateFallbackResponse("What is the latest on this case?", nil, "suspect-interview", "")
	if !strings.Contains(got, "dispatch systems") {
		t.Fatalf("US fallback should keep English dispatch copy, got: %s", got)
	}
}

func TestCNPlaceTagFallbackIsNotEnglishLiveModelDown(t *testing.T) {
	s := &AIService{}
	query := "PIN TYPE: suspect\nNAME: Gao\nADDRESS: 449 Hankou Road, Shanghai\nOFFICER NOTES: 多起谋杀案嫌疑人高某所在住处\n"
	got := s.generateFallbackResponse(query, nil, "in-pursue-place\n[nation:cn]", "")
	if strings.Contains(got, "Live model lookup is down") {
		t.Fatalf("CN pin fallback must not use English live-model-down copy: %s", got)
	}
	if !containsHan(got) {
		t.Fatalf("CN pin fallback must be Simplified Chinese: %s", got)
	}
}

func TestUSPlaceTagFallbackKeepsEnglishLiveModelDown(t *testing.T) {
	s := &AIService{}
	got := s.generateFallbackResponse("PIN TYPE: suspect\nNAME: X\nADDRESS: Main St", nil, "in-pursue-place", "")
	if !strings.Contains(got, "Live model lookup is down") {
		t.Fatalf("US pin fallback should keep English copy, got: %s", got)
	}
}

func TestScreenPromptAcceptsChineseCaseBrief(t *testing.T) {
	s := NewPromptScreener()
	brief := "我正在开始讯问一个多起命案的嫌疑人。他是河南郑州人，在上海境内犯下五起残忍的杀人分尸案件。目前缺少凶器物证，但认证和监控物证齐全。"
	ok, reason := s.ScreenPrompt(brief)
	if !ok {
		t.Fatalf("Chinese case brief should process, got reason=%s", reason)
	}
}

func containsHan(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}
