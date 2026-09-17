package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type LalemChatTurn struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type LalemChatInput struct {
	Locale  string
	Message string
	History []LalemChatTurn
}

type LalemChat struct {
	Reply string `json:"reply"`
}

func (a *LalemAdvisor) AdviseLalemChat(in LalemChatInput) (*LalemChat, error) {
	locale := lalemLocale(in.Locale)
	msg := strings.TrimSpace(in.Message)
	fallback := pickCannedLalemChat(locale, msg, a.now())
	if a == nil || a.CompleteFn == nil {
		return fallback, nil
	}
	raw, err := a.CompleteFn(BuildLalemChatPrompt(LalemChatPromptInput{
		Locale:  locale,
		Now:     a.now(),
		Message: msg,
		History: trimLalemChatHistory(in.History),
	}))
	if err != nil || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	parsed, err := ParseLalemChat(raw)
	if err != nil || parsed == nil || strings.TrimSpace(parsed.Reply) == "" || lalemCompanionDiagnostic(parsed.Reply) {
		return fallback, nil
	}
	parsed.Reply = trimLalemChatText(parsed.Reply)
	if parsed.Reply == "" || lalemCompanionDiagnostic(parsed.Reply) {
		return fallback, nil
	}
	return parsed, nil
}

func ParseLalemChat(raw string) (*LalemChat, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil, fmt.Errorf("empty chat text")
	}
	obj := extractJSONObject(s)
	if strings.HasPrefix(strings.TrimSpace(obj), "{") {
		var m struct {
			Reply string `json:"reply"`
		}
		if err := json.Unmarshal([]byte(obj), &m); err != nil || strings.TrimSpace(m.Reply) == "" {
			return nil, fmt.Errorf("invalid chat json")
		}
		return &LalemChat{Reply: trimLalemChatText(m.Reply)}, nil
	}
	para := trimLalemChatText(s)
	if para == "" {
		return nil, fmt.Errorf("empty chat paragraph")
	}
	return &LalemChat{Reply: para}, nil
}

func cannedLalemChatLines(locale string) []string {
	if lalemLocale(locale) == "cn" {
		return []string{
			"便便科普时间：布里斯托4号像一根光滑的小香肠，给结肠一颗小星星。好笑归好笑，这不是诊断。",
			"马桶不是健身房，轻轻一蹲就好。隔间冷知识，不是处方。",
			"罗马公共厕所坐成一排聊天，社交比冲水阀更古老。咱们还是聊便便吧。",
			"洗手泡沫要给手心手背穿上泡泡雨衣，便便出门也走红毯。",
			"胃结肠反射：吃完饭肠子会敲门，像一只礼貌的小猫。",
			"海绵棒曾经在罗马传来传去，今天我们有自己的小卷纸，幸运。",
			"隔间礼仪：别催隔壁，也别偷看鞋尖，大家都在办正经事。",
			"便便为什么臭？细菌在开小型发酵派对。好笑的生物课，不是诊断。",
		}
	}
	return []string{
		"Bristol type 4 is a smooth little sausage. Gold star for the colon — funny poop science, not a diagnosis.",
		"The bowl is not a gym. Ease up. Cute stall science, never a prescription.",
		"Roman latrines were group chats with stone seats. History’s longest stall hang. Let’s stay on poop.",
		"Soap bubbles are tiny raincoats for your hands. Palms and backs, please.",
		"Gastrocolic reflex: lunch knocks on the colon like a polite kitten.",
		"The xylospongium was a communal sponge-stick. Lucky us, we get our own roll.",
		"Stall manners: don’t peek at shoes, don’t drum the door. Everyone is doing important work.",
		"Why poop smells: microbes throwing a tiny fermentation party. Gross-cute, not a diagnosis.",
	}
}

func pickCannedLalemChat(locale, message string, now time.Time) *LalemChat {
	lines := cannedLalemChatLines(locale)
	if len(lines) == 0 {
		return &LalemChat{Reply: "Wash with soap. Funny poop science, not a diagnosis."}
	}
	if now.IsZero() {
		now = time.Now().UTC()
	}
	n := int(now.Unix())
	for _, r := range message {
		n += int(r)
	}
	if n < 0 {
		n = -n
	}
	return &LalemChat{Reply: lines[n%len(lines)]}
}

func trimLalemChatHistory(in []LalemChatTurn) []LalemChatTurn {
	out := make([]LalemChatTurn, 0, 6)
	for _, turn := range in {
		role := strings.ToLower(strings.TrimSpace(turn.Role))
		text := strings.TrimSpace(turn.Text)
		if text == "" {
			continue
		}
		if role != "user" && role != "assistant" {
			role = "user"
		}
		out = append(out, LalemChatTurn{Role: role, Text: text})
	}
	if len(out) > 6 {
		out = out[len(out)-6:]
	}
	return out
}

func trimLalemChatText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	runes := []rune(s)
	if len(runes) > 600 {
		s = string(runes[:600])
	}
	return strings.TrimSpace(s)
}
