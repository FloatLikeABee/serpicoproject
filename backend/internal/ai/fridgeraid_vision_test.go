package ai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFridgeRaidVisionModelFollowsSerpicoLiveConfig(t *testing.T) {
	t.Setenv("FRIDGE_RAID_VISION_MODEL", "")
	t.Setenv("SILICONFLOW_MODEL", "")
	t.Setenv("QWEN_MODEL", "")
	if FridgeRaidVisionModel() != defaultLiveModel {
		t.Fatalf("unset env should use Serpico live model %s, got %s", defaultLiveModel, FridgeRaidVisionModel())
	}
	t.Setenv("SILICONFLOW_MODEL", "deepseek-ai/DeepSeek-V4-Flash")
	if FridgeRaidVisionModel() != "deepseek-ai/DeepSeek-V4-Flash" {
		t.Fatalf("SILICONFLOW_MODEL should win when FRIDGE_RAID_VISION_MODEL unset, got %s", FridgeRaidVisionModel())
	}
	t.Setenv("FRIDGE_RAID_VISION_MODEL", "custom-vl-override")
	if FridgeRaidVisionModel() != "custom-vl-override" {
		t.Fatalf("explicit FRIDGE_RAID_VISION_MODEL should win, got %s", FridgeRaidVisionModel())
	}
}

func TestFridgeRaidVisionRequestIncludesImageURL(t *testing.T) {
	t.Setenv("FRIDGE_RAID_VISION_MODEL", "")
	t.Setenv("SILICONFLOW_MODEL", "")
	t.Setenv("QWEN_MODEL", "")
	var raw map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(body, &raw); err != nil {
			t.Errorf("body json: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"eggs, tomatoes"}}]}`))
	}))
	t.Cleanup(srv.Close)

	v := NewFridgeRaidVisionClient("sk-vision", "", srv.URL+"/v1")
	got, err := v.IdentifyIngredients([]byte("jpeg-bytes"), "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	if got != "eggs, tomatoes" {
		t.Fatalf("got %q", got)
	}
	if raw["model"] != defaultLiveModel {
		t.Fatalf("model=%v want %s", raw["model"], defaultLiveModel)
	}
	blob, _ := json.Marshal(raw)
	if !strings.Contains(string(blob), "image_url") {
		t.Fatalf("request missing image_url: %s", blob)
	}
	if !strings.Contains(string(blob), "data:image/jpeg;base64,") {
		t.Fatalf("request missing data URL: %s", blob)
	}
}

func TestQwenGenerateResponseContentStaysString(t *testing.T) {
	var contentKind string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		msgs, _ := req["messages"].([]interface{})
		if len(msgs) > 0 {
			m := msgs[0].(map[string]interface{})
			contentKind = fmt.Sprintf("%T", m["content"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"Copy that."}}]}`))
	}))
	t.Cleanup(srv.Close)
	q := NewQwenClient("sk-test", defaultLiveModel, srv.URL+"/v1")
	_, err := q.GenerateResponse("hello", "chat", nil, nil, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if contentKind != "string" {
		t.Fatalf("officer GenerateResponse content kind=%s, want string", contentKind)
	}
}
