package ai

import (
	"encoding/json"
	"fmt"
	"strings"
)

type LalemDigest struct {
	GeneratedAt string       `json:"generatedAt"`
	Locale      string       `json:"locale"`
	Disclaimer  string       `json:"disclaimer"`
	Trends      []LalemTrend `json:"trends"`
	Videos      []LalemVideo `json:"videos"`
	Useful      []string     `json:"useful"`
}

type LalemTrend struct {
	Kind      string   `json:"kind"`
	Title     string   `json:"title"`
	Hook      string   `json:"hook"`
	ImageURL  string   `json:"imageUrl"`
	ImageHint string   `json:"imageHint,omitempty"`
	Chips     []string `json:"chips,omitempty"`
}

func ParseLalemDigest(raw string) (*LalemDigest, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, fmt.Errorf("empty model text: expected json")
	}
	s = extractJSONObject(s)
	if !strings.HasPrefix(strings.TrimSpace(s), "{") {
		return nil, fmt.Errorf("model text is not lalem json")
	}
	var top map[string]json.RawMessage
	if err := json.Unmarshal([]byte(s), &top); err != nil {
		return nil, fmt.Errorf("model text is not lalem json: %w", err)
	}
	digest := LalemDigest{
		GeneratedAt: jsonString(top["generatedAt"]),
		Locale:      jsonString(top["locale"]),
		Disclaimer:  jsonString(top["disclaimer"]),
		Trends:      parseLalemTrends(top["trends"]),
		Useful:      parseStringList(top["useful"]),
	}
	if len(digest.Trends) == 0 && len(digest.Useful) == 0 {
		return nil, fmt.Errorf("lalem json missing trends")
	}
	if len(digest.Trends) > 8 {
		digest.Trends = digest.Trends[:8]
	}
	if len(digest.Useful) > 6 {
		digest.Useful = digest.Useful[:6]
	}
	return &digest, nil
}

func ParseLalemIncrement(raw string) (*LalemDigest, error) {
	got, err := ParseLalemDigest(raw)
	if err != nil {
		return nil, err
	}
	if len(got.Trends) > 2 {
		got.Trends = got.Trends[:2]
	}
	if len(got.Useful) > 1 {
		got.Useful = got.Useful[:1]
	}
	return got, nil
}

func parseLalemTrends(raw json.RawMessage) []LalemTrend {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var arr []json.RawMessage
	if err := json.Unmarshal(raw, &arr); err != nil {
		return nil
	}
	out := make([]LalemTrend, 0, len(arr))
	for _, item := range arr {
		var m map[string]json.RawMessage
		if err := json.Unmarshal(item, &m); err != nil {
			continue
		}
		kind := normalizeLalemKind(jsonString(m["kind"]))
		tr := LalemTrend{
			Kind:      kind,
			Title:     jsonString(m["title"]),
			Hook:      jsonString(m["hook"]),
			ImageURL:  jsonString(m["imageUrl"]),
			ImageHint: jsonString(m["imageHint"]),
			Chips:     parseStringList(m["chips"]),
		}
		if tr.Title == "" && tr.Hook == "" {
			continue
		}
		out = append(out, tr)
	}
	return out
}

func normalizeLalemKind(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "entertainment", "ent", "综艺", "娱乐":
		return "entertainment"
	case "fashion", "时尚", "美妆":
		return "fashion"
	default:
		if v == "" {
			return "other"
		}
		return "other"
	}
}
