package ai

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ImageGenerator creates scenario visuals for Chase Game.
type ImageGenerator struct {
	config *Config
	client *http.Client
}

func NewImageGenerator(config *Config) *ImageGenerator {
	return &ImageGenerator{
		config: config,
		client: &http.Client{Timeout: 90 * time.Second},
	}
}

// GenerateScenarioImage returns a URL or data-URI for the pursuit scenario.
func (g *ImageGenerator) GenerateScenarioImage(prompt string) (string, error) {
	provider := strings.ToLower(strings.TrimSpace(g.config.ImageProvider))
	if provider == "" {
		provider = "placeholder"
	}

	switch provider {
	case "openai":
		if url, err := g.generateOpenAI(prompt); err == nil {
			return url, nil
		}
	case "stability":
		if url, err := g.generateStability(prompt); err == nil {
			return url, nil
		}
	case "replicate":
		if url, err := g.generateReplicate(prompt); err == nil {
			return url, nil
		}
	}

	return g.placeholderImage(prompt), nil
}

func (g *ImageGenerator) generateOpenAI(prompt string) (string, error) {
	if g.config.OpenAIAPIKey == "" {
		return "", fmt.Errorf("OPENAI_API_KEY not configured")
	}

	body, _ := json.Marshal(map[string]interface{}{
		"model":           g.config.OpenAIImageModel,
		"prompt":          prompt,
		"n":               1,
		"size":            "1024x1024",
		"response_format": "url",
	})

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/images/generations", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.config.OpenAIAPIKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openai image error: %d - %s", resp.StatusCode, string(data))
	}

	var result struct {
		Data []struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Data) == 0 || result.Data[0].URL == "" {
		return "", fmt.Errorf("openai returned no image")
	}
	return result.Data[0].URL, nil
}

func (g *ImageGenerator) generateStability(prompt string) (string, error) {
	if g.config.StabilityAPIKey == "" {
		return "", fmt.Errorf("STABILITY_API_KEY not configured")
	}

	host := strings.TrimRight(g.config.StabilityAPIHost, "/")
	url := fmt.Sprintf("%s/v1/generation/%s/text-to-image", host, g.config.StabilityImageModel)

	body, _ := json.Marshal(map[string]interface{}{
		"text_prompts": []map[string]interface{}{
			{"text": prompt, "weight": 1},
		},
		"cfg_scale": 7,
		"height":    768,
		"width":     1024,
		"samples":   1,
		"steps":     30,
	})

	req, err := http.NewRequest("POST", url, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.config.StabilityAPIKey)

	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("stability image error: %d - %s", resp.StatusCode, string(data))
	}

	var result struct {
		Artifacts []struct {
			Base64 string `json:"base64"`
		} `json:"artifacts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}
	if len(result.Artifacts) == 0 || result.Artifacts[0].Base64 == "" {
		return "", fmt.Errorf("stability returned no image")
	}
	return "data:image/png;base64," + result.Artifacts[0].Base64, nil
}

func (g *ImageGenerator) generateReplicate(prompt string) (string, error) {
	if g.config.ReplicateAPIToken == "" {
		return "", fmt.Errorf("REPLICATE_API_TOKEN not configured")
	}

	body, _ := json.Marshal(map[string]interface{}{
		"input": map[string]interface{}{
			"prompt": prompt,
		},
	})

	req, err := http.NewRequest("POST", "https://api.replicate.com/v1/models/"+g.config.ReplicateImageModel+"/predictions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+g.config.ReplicateAPIToken)

	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("replicate create error: %d - %s", resp.StatusCode, string(data))
	}

	var prediction struct {
		URLs struct {
			Get string `json:"get"`
		} `json:"urls"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&prediction); err != nil {
		return "", err
	}
	if prediction.URLs.Get == "" {
		return "", fmt.Errorf("replicate returned no poll URL")
	}

	deadline := time.Now().Add(75 * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)

		pollReq, err := http.NewRequest("GET", prediction.URLs.Get, nil)
		if err != nil {
			return "", err
		}
		pollReq.Header.Set("Authorization", "Bearer "+g.config.ReplicateAPIToken)

		pollResp, err := g.client.Do(pollReq)
		if err != nil {
			return "", err
		}

		var pollResult struct {
			Status string   `json:"status"`
			Output []string `json:"output"`
		}
		decodeErr := json.NewDecoder(pollResp.Body).Decode(&pollResult)
		pollResp.Body.Close()
		if decodeErr != nil {
			return "", decodeErr
		}

		if pollResult.Status == "succeeded" && len(pollResult.Output) > 0 {
			return pollResult.Output[0], nil
		}
		if pollResult.Status == "failed" || pollResult.Status == "canceled" {
			return "", fmt.Errorf("replicate prediction %s", pollResult.Status)
		}
	}

	return "", fmt.Errorf("replicate prediction timed out")
}

func (g *ImageGenerator) placeholderImage(prompt string) string {
	label := prompt
	if len(label) > 80 {
		label = label[:77] + "..."
	}
	label = strings.ReplaceAll(label, `"`, `'`)
	svg := fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="576" viewBox="0 0 1024 576">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%%" stop-color="#1e3a8a"/>
<stop offset="100%%" stop-color="#991b1b"/>
</linearGradient>
</defs>
<rect width="1024" height="576" fill="url(#g)"/>
<rect x="40" y="40" width="944" height="496" rx="24" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.35)" stroke-width="4"/>
<text x="512" y="250" fill="#ffffff" font-size="42" font-family="Arial, sans-serif" text-anchor="middle" font-weight="700">CHASE GAME SCENE</text>
<text x="512" y="320" fill="#e5e7eb" font-size="24" font-family="Arial, sans-serif" text-anchor="middle">%s</text>
<text x="512" y="420" fill="#93c5fd" font-size="18" font-family="Arial, sans-serif" text-anchor="middle">Configure IMAGE_PROVIDER in .env for AI-generated visuals</text>
</svg>`, label)
	return "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte(svg))
}
