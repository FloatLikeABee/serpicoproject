package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type LalemCompanionInput struct {
	Locale string
}

type LalemCompanion struct {
	Text  string `json:"text"`
	Angle string `json:"angle"`
}

func (a *LalemAdvisor) AdviseLalemCompanion(in LalemCompanionInput) (*LalemCompanion, error) {
	locale := lalemLocale(in.Locale)
	fallback := pickCannedLalemCompanion(locale, a.now())
	if a == nil || a.CompleteFn == nil {
		return fallback, nil
	}
	raw, err := a.CompleteFn(BuildLalemCompanionPrompt(LalemCompanionPromptInput{Locale: locale, Now: a.now()}))
	if err != nil || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	parsed, err := ParseLalemCompanion(raw)
	if err != nil || parsed == nil || strings.TrimSpace(parsed.Text) == "" || lalemCompanionDiagnostic(parsed.Text) {
		return fallback, nil
	}
	parsed.Angle = normalizeLalemCompanionAngle(parsed.Angle)
	parsed.Text = trimLalemCompanionText(parsed.Text)
	if parsed.Text == "" || lalemCompanionDiagnostic(parsed.Text) {
		return fallback, nil
	}
	return parsed, nil
}

func ParseLalemCompanion(raw string) (*LalemCompanion, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, fmt.Errorf("empty companion text")
	}
	obj := extractJSONObject(s)
	if strings.HasPrefix(strings.TrimSpace(obj), "{") {
		var m struct {
			Text  string `json:"text"`
			Angle string `json:"angle"`
		}
		if err := json.Unmarshal([]byte(obj), &m); err == nil && strings.TrimSpace(m.Text) != "" {
			return &LalemCompanion{
				Text:  trimLalemCompanionText(m.Text),
				Angle: normalizeLalemCompanionAngle(m.Angle),
			}, nil
		}
	}
	line := firstCompanionLine(s)
	if line == "" {
		return nil, fmt.Errorf("empty companion line")
	}
	return &LalemCompanion{Text: line, Angle: "biological"}, nil
}

func cannedLalemCompanionLines(locale string) []LalemCompanion {
	if lalemLocale(locale) == "cn" {
		return []LalemCompanion{
			{Angle: "medical", Text: "便便科普：别把马桶当举重器，轻轻一蹲就好，这不是诊断。"},
			{Angle: "biological", Text: "布里斯托量表像一盒彩虹糖，4号是光滑的小香肠，可爱吧。"},
			{Angle: "social", Text: "公共厕所对视一秒，双方立刻研究手机壁纸，礼仪满分。"},
			{Angle: "historical", Text: "罗马公共厕所坐成一排聊天，社交比冲水阀更古老。"},
			{Angle: "medical", Text: "洗手泡沫要给手心手背都穿上泡泡雨衣，便便出门也走红毯。"},
			{Angle: "biological", Text: "胃结肠反射：吃完饭肠子会敲门，像一只礼貌的小猫。"},
			{Angle: "social", Text: "隔间礼仪：别催隔壁，也别偷看鞋尖，大家都在办正经事。"},
			{Angle: "historical", Text: "海绵棒曾经在罗马传来传去，今天我们有自己的小卷纸，幸运。"},
		}
	}
	return []LalemCompanion{
		{Angle: "medical", Text: "Poop science whisper: the bowl is not a gym. Ease up — not a diagnosis, just a cute nudge."},
		{Angle: "biological", Text: "Bristol’s cute rainbow: type 4 is a smooth little sausage. Gold star for the colon."},
		{Angle: "social", Text: "Public-loo etiquette: accidental eye contact means both of you must study your phones."},
		{Angle: "historical", Text: "Roman latrines were group chats with stone seats. History’s longest stall hang."},
		{Angle: "medical", Text: "Soap bubbles are tiny raincoats for your hands. Palms and backs, please."},
		{Angle: "biological", Text: "Gastrocolic reflex: lunch knocks on the colon like a polite kitten."},
		{Angle: "social", Text: "Stall manners: don’t peek at shoes, don’t drum the door. Everyone is doing important work."},
		{Angle: "historical", Text: "The xylospongium was a communal sponge-stick. Lucky us, we get our own roll."},
	}
}

func pickCannedLalemCompanion(locale string, now time.Time) *LalemCompanion {
	lines := cannedLalemCompanionLines(locale)
	if len(lines) == 0 {
		return &LalemCompanion{Text: "Wash with soap. Cute reminder, not a diagnosis.", Angle: "medical"}
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	line := lines[int(now.Unix())%len(lines)]
	return &LalemCompanion{Text: line.Text, Angle: line.Angle}
}

func normalizeLalemCompanionAngle(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch {
	case v == "medical" || strings.Contains(v, "医"):
		return "medical"
	case v == "biological" || v == "biology" || strings.Contains(v, "生物"):
		return "biological"
	case v == "social" || strings.Contains(v, "社交") || strings.Contains(v, "礼仪"):
		return "social"
	case v == "historical" || v == "history" || strings.Contains(v, "历史"):
		return "historical"
	default:
		return "biological"
	}
}

func lalemCompanionDiagnostic(s string) bool {
	low := strings.ToLower(s)
	if strings.Contains(low, "you have") || strings.Contains(s, "你患有") {
		return true
	}
	banned := []string{"diagnose", "prescribe", "诊断", "处方"}
	for _, b := range banned {
		if strings.Contains(low, b) || strings.Contains(s, b) {
			return true
		}
	}
	return false
}

func trimLalemCompanionText(s string) string {
	s = strings.TrimSpace(firstCompanionLine(s))
	runes := []rune(s)
	if len(runes) > 180 {
		s = string(runes[:180])
	}
	return strings.TrimSpace(s)
}

func firstCompanionLine(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	if i := strings.IndexAny(s, "\n\r"); i >= 0 {
		s = s[:i]
	}
	return strings.TrimSpace(s)
}
