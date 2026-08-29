package ai

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestNewGeminiChatRequestIncludesSafetySettings(t *testing.T) {
	req := newGeminiChatRequest("hello")
	if len(req.SafetySettings) == 0 {
		t.Fatal("expected safety settings so interview/crime coaching is not blocked")
	}
	raw, err := json.Marshal(req)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "BLOCK_NONE") {
		t.Fatalf("safety thresholds missing from payload: %s", raw)
	}
	if !strings.Contains(string(raw), "HARM_CATEGORY_DANGEROUS_CONTENT") {
		t.Fatalf("dangerous-content category missing from payload: %s", raw)
	}
}

func TestIsRetryableGeminiError(t *testing.T) {
	cases := []struct {
		err  error
		want bool
	}{
		{nil, false},
		{errors.New("API error: 400 - invalid argument"), false},
		{errors.New("API error: 429 - RESOURCE_EXHAUSTED"), true},
		{errors.New("API error: 503 - unavailable"), true},
		{errors.New("empty response from API (SAFETY)"), true},
		{errors.New("empty response from API: blocked (SAFETY)"), true},
		{errors.New("failed to make request: context deadline exceeded (timeout)"), true},
	}
	for _, tc := range cases {
		if got := isRetryableGeminiError(tc.err); got != tc.want {
			t.Errorf("isRetryableGeminiError(%v) = %v, want %v", tc.err, got, tc.want)
		}
	}
}
