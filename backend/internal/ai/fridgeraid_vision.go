package ai

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const defaultFridgeRaidVisionModel = defaultLiveModel

type FridgeRaidVisionClient struct {
	apiKey  string
	model   string
	baseURL string
	client  *http.Client
}

func FridgeRaidVisionModel() string {
	model := strings.TrimSpace(os.Getenv("FRIDGE_RAID_VISION_MODEL"))
	if model == "" || isStaleFridgeRaidVisionModel(model) {
		return liveModelName()
	}
	return model
}

func isStaleFridgeRaidVisionModel(model string) bool {
	l := strings.ToLower(model)
	return strings.Contains(l, "qwen2.5-vl") || strings.Contains(l, "qwen3-vl")
}

func NewFridgeRaidVisionClient(apiKey, model, baseURL string) *FridgeRaidVisionClient {
	if strings.TrimSpace(model) == "" {
		model = FridgeRaidVisionModel()
	}
	if strings.TrimSpace(baseURL) == "" {
		baseURL = defaultLiveBaseURL
	}
	return &FridgeRaidVisionClient{
		apiKey:  sanitizeAPIKey(apiKey),
		model:   model,
		baseURL: baseURL,
		client:  &http.Client{Timeout: 55 * time.Second},
	}
}

func (v *FridgeRaidVisionClient) Enabled() bool {
	return v != nil && v.apiKey != ""
}

type visionChatRequest struct {
	Model    string          `json:"model"`
	Messages []visionMessage `json:"messages"`
}

type visionMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

// IdentifyIngredients asks a VL model to list edible leftovers visible in the photo.
func (v *FridgeRaidVisionClient) IdentifyIngredients(image []byte, mime string) (string, error) {
	if v == nil || !v.Enabled() {
		return "", fmt.Errorf("fridge-raid vision is not configured")
	}
	if mime == "" {
		mime = "image/jpeg"
	}
	dataURL := "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(image)
	parts := []map[string]interface{}{
		{
			"type":      "image_url",
			"image_url": map[string]string{"url": dataURL},
		},
		{
			"type": "text",
			"text": "List the edible leftovers and ingredients visible in this fridge photo as a short comma-separated list. If you cannot tell, say UNKNOWN.",
		},
	}
	partJSON, err := json.Marshal(parts)
	if err != nil {
		return "", err
	}
	reqBody := visionChatRequest{
		Model: v.model,
		Messages: []visionMessage{
			{Role: "user", Content: partJSON},
		},
	}
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequest(http.MethodPost, qwenCompletionsURL(v.baseURL), bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+v.apiKey)
	resp, err := v.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("vision status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var chatResp qwenChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return "", err
	}
	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("empty vision response")
	}
	text := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	if text == "" {
		return "", fmt.Errorf("empty vision response")
	}
	return text, nil
}
