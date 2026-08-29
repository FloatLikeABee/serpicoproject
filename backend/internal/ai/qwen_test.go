package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLiveModelDefaultSettings(t *testing.T) {
	if defaultLiveModel != "deepseek-ai/DeepSeek-V4-Flash" {
		t.Fatalf("default live model = %s, want deepseek-ai/DeepSeek-V4-Flash", defaultLiveModel)
	}
	if defaultLiveBaseURL != "https://api.siliconflow.cn/v1" {
		t.Fatalf("default live base URL = %s", defaultLiveBaseURL)
	}
	if qwenCompletionsURL(defaultLiveBaseURL) != defaultLiveBaseURL+"/chat/completions" {
		t.Fatalf("completions URL mismatch: %s", qwenCompletionsURL(defaultLiveBaseURL))
	}
	if qwenCompletionsURL(defaultLiveBaseURL+"/chat/completions") != defaultLiveBaseURL+"/chat/completions" {
		t.Fatal("completions URL should not double-append")
	}
}

func TestQwenClientGenerate(t *testing.T) {
	var gotModel string
	var thinking *bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
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
		thinking = req.EnableThinking
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"Copy that."}}]}`))
	}))
	defer srv.Close()

	q := NewQwenClient("sk-test", "deepseek-ai/DeepSeek-V4-Flash", srv.URL+"/v1")
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
	if gotModel != "deepseek-ai/DeepSeek-V4-Flash" {
		t.Fatalf("model = %s", gotModel)
	}
	if thinking == nil || *thinking {
		t.Fatalf("enable_thinking should be false, got %v", thinking)
	}
}

func TestLoadConfigLiveModelSettings(t *testing.T) {
	t.Setenv("GEMINI_API_KEY", "g")
	t.Setenv("MISTRAL_API_KEY", "m")
	t.Setenv("SILICONFLOW_API_KEY", "sk-sf")
	t.Setenv("QWEN_API_KEY", "sk-qwen")
	t.Setenv("DASHSCOPE_API_KEY", "sk-dash")
	t.Setenv("QWEN_MODEL", "qwen-plus")
	t.Setenv("QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
	t.Setenv("SILICONFLOW_MODEL", "")
	t.Setenv("SILICONFLOW_BASE_URL", "")
	cfg := LoadConfig()
	if cfg.QwenAPIKey != "sk-sf" {
		t.Fatalf("SILICONFLOW_API_KEY should win, got %s", cfg.QwenAPIKey)
	}
	if cfg.QwenModel != defaultLiveModel {
		t.Fatalf("stale qwen-plus should map to %s, got %s", defaultLiveModel, cfg.QwenModel)
	}
	if cfg.QwenBaseURL != defaultLiveBaseURL {
		t.Fatalf("stale dashscope URL should map to %s, got %s", defaultLiveBaseURL, cfg.QwenBaseURL)
	}

	t.Setenv("SILICONFLOW_API_KEY", "")
	t.Setenv("QWEN_API_KEY", "")
	t.Setenv("DASHSCOPE_API_KEY", "")
	cfg = LoadConfig()
	if cfg.QwenAPIKey != defaultLiveAPIKey {
		t.Fatalf("built-in SiliconFlow key fallback, got %s", cfg.QwenAPIKey)
	}
}

func TestQwenDisabledWithoutKey(t *testing.T) {
	q := NewQwenClient("", defaultLiveModel, defaultLiveBaseURL)
	if q.Enabled() {
		t.Fatal("empty key should disable the live client")
	}
}
