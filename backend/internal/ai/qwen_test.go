package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestQwenDefaultSettings(t *testing.T) {
	if defaultQwenModel != "qwen-plus" {
		t.Fatalf("default Qwen model = %s, want qwen-plus", defaultQwenModel)
	}
	if defaultQwenBaseURL != "https://dashscope-intl.aliyuncs.com/compatible-mode/v1" {
		t.Fatalf("default Qwen base URL = %s", defaultQwenBaseURL)
	}
	if qwenCompletionsURL(defaultQwenBaseURL) != defaultQwenBaseURL+"/chat/completions" {
		t.Fatalf("completions URL mismatch: %s", qwenCompletionsURL(defaultQwenBaseURL))
	}
	if qwenCompletionsURL(defaultQwenBaseURL+"/chat/completions") != defaultQwenBaseURL+"/chat/completions" {
		t.Fatal("completions URL should not double-append")
	}
}

func TestQwenClientGenerate(t *testing.T) {
	var gotModel string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/compatible-mode/v1/chat/completions" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer sk-test") {
			t.Errorf("missing bearer token")
		}
		var req qwenChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		gotModel = req.Model
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"Copy that."}}]}`))
	}))
	defer srv.Close()

	q := NewQwenClient("sk-test", "qwen-plus", srv.URL+"/compatible-mode/v1")
	if !q.Enabled() {
		t.Fatal("expected enabled client")
	}
	got, err := q.GenerateWithPrompt("sys", "hello")
	if err != nil {
		t.Fatal(err)
	}
	if got != "Copy that." {
		t.Fatalf("got %q", got)
	}
	if gotModel != "qwen-plus" {
		t.Fatalf("model = %s", gotModel)
	}
}

func TestLoadConfigQwenSettings(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "g")
	t.Setenv("MISTRAL_API_KEY", "m")
	t.Setenv("QWEN_API_KEY", "sk-qwen")
	t.Setenv("DASHSCOPE_API_KEY", "sk-dash")
	t.Setenv("QWEN_MODEL", "")
	t.Setenv("QWEN_BASE_URL", "")
	cfg := LoadConfig()
	if cfg.QwenAPIKey != "sk-qwen" {
		t.Fatalf("QWEN_API_KEY should win, got %s", cfg.QwenAPIKey)
	}
	if cfg.QwenModel != "qwen-plus" {
		t.Fatalf("default model %s", cfg.QwenModel)
	}
	if cfg.QwenBaseURL != defaultQwenBaseURL {
		t.Fatalf("default base URL %s", cfg.QwenBaseURL)
	}

	t.Setenv("QWEN_API_KEY", "")
	cfg = LoadConfig()
	if cfg.QwenAPIKey != "sk-dash" {
		t.Fatalf("DASHSCOPE_API_KEY fallback, got %s", cfg.QwenAPIKey)
	}
}

func TestQwenDisabledWithoutKey(t *testing.T) {
	q := NewQwenClient("", "qwen-plus", defaultQwenBaseURL)
	if q.Enabled() {
		t.Fatal("empty key should disable Qwen")
	}
}
