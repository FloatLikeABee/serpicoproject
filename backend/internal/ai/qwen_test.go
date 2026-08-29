package ai

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestLiveModelDefaultSettings(t *testing.T) {
	if defaultLiveModel != "deepseek-ai/DeepSeek-V4-Flash" {
		t.Fatalf("default live model = %s, want deepseek-ai/DeepSeek-V4-Flash", defaultLiveModel)
	}
	if defaultLiveBaseURL != "https://api.siliconflow.com/v1" {
		t.Fatalf("default live base URL = %s", defaultLiveBaseURL)
	}
	wantURL := "https://api.siliconflow.com/v1/chat/completions"
	if qwenCompletionsURL(defaultLiveBaseURL) != wantURL {
		t.Fatalf("completions URL = %s, want %s", qwenCompletionsURL(defaultLiveBaseURL), wantURL)
	}
	if qwenCompletionsURL(defaultLiveBaseURL+"/chat/completions") != wantURL {
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

	t.Setenv("QWEN_BASE_URL", chinaLiveBaseURL)
	cfg = LoadConfig()
	if cfg.QwenBaseURL != defaultLiveBaseURL {
		t.Fatalf("stale .cn on QWEN_BASE_URL should map to %s, got %s", defaultLiveBaseURL, cfg.QwenBaseURL)
	}

	t.Setenv("SILICONFLOW_BASE_URL", chinaLiveBaseURL)
	cfg = LoadConfig()
	if cfg.QwenBaseURL != chinaLiveBaseURL {
		t.Fatalf("explicit SILICONFLOW_BASE_URL .cn should stay, got %s", cfg.QwenBaseURL)
	}

	t.Setenv("SILICONFLOW_API_KEY", "")
	t.Setenv("QWEN_API_KEY", "")
	t.Setenv("DASHSCOPE_API_KEY", "")
	t.Setenv("SILICONFLOW_BASE_URL", "")
	cfg = LoadConfig()
	if cfg.QwenAPIKey != "" {
		t.Fatalf("no env key should be empty, got %s", cfg.QwenAPIKey)
	}
}

func TestQwenDisabledWithoutKey(t *testing.T) {
	q := NewQwenClient("", defaultLiveModel, defaultLiveBaseURL)
	if q.Enabled() {
		t.Fatal("empty key should disable the live client")
	}
	cfg := LoadConfig()
	if os.Getenv("SILICONFLOW_API_KEY") == "" && os.Getenv("QWEN_API_KEY") == "" && os.Getenv("DASHSCOPE_API_KEY") == "" {
		client := NewQwenClient(cfg.QwenAPIKey, cfg.QwenModel, cfg.QwenBaseURL)
		if client.Enabled() {
			t.Fatal("LoadConfig without SILICONFLOW_API_KEY must not enable a live client")
		}
	}
}

func TestLiveModelAuthClassOn401(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`Api key is invalid`))
	}))
	defer srv.Close()

	q := NewQwenClient("sk-bad", defaultLiveModel, srv.URL+"/v1")
	_, err := q.GenerateWithPrompt("sys", "hello")
	if err == nil {
		t.Fatal("expected 401 error")
	}
	var le *liveModelCallError
	if !errors.As(err, &le) {
		t.Fatalf("want liveModelCallError, got %T %v", err, err)
	}
	if le.Class != liveErrAuth || le.Status != http.StatusUnauthorized {
		t.Fatalf("class=%s status=%d", le.Class, le.Status)
	}

	svc := &AIService{
		config:   &Config{EnableWebSearch: false, QwenModel: defaultLiveModel, QwenBaseURL: srv.URL + "/v1"},
		qwen:     q,
		screener: NewPromptScreener(),
		rag:      &RAGDatabase{},
	}
	got, chatErr := svc.ProcessChat("What is the status of this case file?", "chat", nil)
	if chatErr != nil {
		t.Fatalf("ProcessChat should return HTTP-layer nil err with fallback, got %v", chatErr)
	}
	if !strings.Contains(got, "dispatch systems") {
		t.Fatalf("expected canned US fallback, got %q", got)
	}
	if strings.Contains(got, "现场模型") {
		t.Fatalf("US fallback should not be Chinese, got %q", got)
	}
}

func TestProcessChatLiveSuccessNotFallback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"Live brief: suspect last seen at the pier."}}]}`))
	}))
	defer srv.Close()

	q := NewQwenClient("sk-ok", defaultLiveModel, srv.URL+"/v1")
	svc := &AIService{
		config:   &Config{EnableWebSearch: false, QwenModel: defaultLiveModel, QwenBaseURL: srv.URL + "/v1"},
		qwen:     q,
		screener: NewPromptScreener(),
		rag:      &RAGDatabase{},
	}
	got, err := svc.ProcessChat("What is the status of this case file?", "chat", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "Live brief: suspect last seen at the pier.") {
		t.Fatalf("want live text, got %q", got)
	}
	if strings.Contains(got, "dispatch systems") || strings.Contains(got, "现场模型") {
		t.Fatalf("live success must not be fallback, got %q", got)
	}

	promptGot, promptErr := q.GenerateWithPrompt("sys", "hello")
	if promptErr != nil {
		t.Fatal(promptErr)
	}
	if !strings.Contains(promptGot, "Live brief") {
		t.Fatalf("GenerateWithPrompt = %q", promptGot)
	}
}
