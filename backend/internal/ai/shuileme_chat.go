package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type ShuilemeChatTurn struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type ShuilemeChatInput struct {
	Locale  string
	Message string
	History []ShuilemeChatTurn
}

type ShuilemeChat struct {
	Reply string `json:"reply"`
}

type ShuilemeAdvisor struct {
	Now        time.Time
	CompleteFn func(prompt string) (string, error)
}

func (a *ShuilemeAdvisor) now() time.Time {
	if a != nil && !a.Now.IsZero() {
		return a.Now
	}
	return time.Now().UTC()
}

func (a *ShuilemeAdvisor) AdviseShuilemeChat(in ShuilemeChatInput) (*ShuilemeChat, error) {
	locale := lalemLocale(in.Locale)
	msg := strings.TrimSpace(in.Message)
	fallback := pickCannedShuilemeChat(locale, msg, a.now())
	if a == nil || a.CompleteFn == nil {
		return fallback, nil
	}
	raw, err := a.CompleteFn(BuildShuilemeChatPrompt(ShuilemeChatPromptInput{
		Locale:  locale,
		Now:     a.now(),
		Message: msg,
		History: trimShuilemeChatHistory(in.History),
	}))
	if err != nil || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	parsed, err := ParseShuilemeChat(raw)
	if err != nil || parsed == nil || strings.TrimSpace(parsed.Reply) == "" || lalemCompanionDiagnostic(parsed.Reply) {
		return fallback, nil
	}
	parsed.Reply = trimLalemChatText(parsed.Reply)
	if parsed.Reply == "" || lalemCompanionDiagnostic(parsed.Reply) {
		return fallback, nil
	}
	return parsed, nil
}

func ParseShuilemeChat(raw string) (*ShuilemeChat, error) {
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
		return &ShuilemeChat{Reply: trimLalemChatText(m.Reply)}, nil
	}
	para := trimLalemChatText(s)
	if para == "" {
		return nil, fmt.Errorf("empty chat paragraph")
	}
	return &ShuilemeChat{Reply: para}, nil
}

func cannedShuilemeChatLines(locale string) []string {
	if lalemLocale(locale) == "cn" {
		return []string{
			"加法可以左右交换。一加二等于二加一。句子短，读着慢。",
			"合同是双方同意的字。字写清楚，事情才安静。",
			"夜空看起来暗，因为没有阳光被空气散射。这是简单的光学。",
			"三角形三个内角加起来是一百八十度。数一数就会困。",
			"力等于质量乘加速度。车停了，加速度是零。",
			"偶数可以被二整除。二、四、六，一直数下去。",
			"法律里的“应当”表示义务。做完规定的事，就可以休息。",
			"水在一百摄氏度沸腾，在一个标准大气压下。温度是数字，不是情绪。",
		}
	}
	return []string{
		"Addition is commutative. One plus two equals two plus one. Short sentences.",
		"A contract is words both sides accept. Clear words. Then rest.",
		"Night looks dark because sunlight is not scattering in the air. Simple optics.",
		"The three angles of a triangle add to one hundred eighty degrees. Count slowly.",
		"Force equals mass times acceleration. When the car is still, acceleration is zero.",
		"Even numbers divide by two. Two, four, six. Keep counting.",
		"In law, “shall” means a duty. Finish the duty. Then sleep.",
		"Water boils at one hundred degrees at standard pressure. A number, not a mood.",
	}
}

func pickCannedShuilemeChat(locale, message string, now time.Time) *ShuilemeChat {
	lines := cannedShuilemeChatLines(locale)
	if len(lines) == 0 {
		return &ShuilemeChat{Reply: "One plus one is two. Short sentences."}
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
	return &ShuilemeChat{Reply: lines[n%len(lines)]}
}

func trimShuilemeChatHistory(in []ShuilemeChatTurn) []ShuilemeChatTurn {
	out := make([]ShuilemeChatTurn, 0, 6)
	for _, turn := range in {
		role := strings.ToLower(strings.TrimSpace(turn.Role))
		text := strings.TrimSpace(turn.Text)
		if text == "" {
			continue
		}
		if role != "user" && role != "assistant" {
			role = "user"
		}
		out = append(out, ShuilemeChatTurn{Role: role, Text: text})
	}
	if len(out) > 6 {
		out = out[len(out)-6:]
	}
	return out
}

const shuilemeChatSystemPrompt = `You are 睡了么, a slow, boring lecturer at bedtime.

OUTPUT:
- Return JSON only: {"reply":"..."}
- Short easy sentences. Law, science, or math only. Dry. No jokes. No exclamation marks. No pep. No "wake up".
- If the visitor asks about police work, leftover cooking, poop, news, or anything lively, steer back to a dull theorem, statute, or science fact.
- Never diagnose. Never say "you have" or "你患有". Never prescribe treatment. No URLs. No wikipedia links.
- Tone: boring and easy to fall asleep to. This is not medical advice.
`

type ShuilemeChatPromptInput struct {
	Locale  string
	Now     time.Time
	Message string
	History []ShuilemeChatTurn
}

func BuildShuilemeChatPrompt(in ShuilemeChatPromptInput) string {
	var b strings.Builder
	b.WriteString(shuilemeChatSystemPrompt)
	b.WriteString("\n")
	locale, dateLine := lalemPromptLocaleDate(LalemDigestPromptInput{Locale: in.Locale, Now: in.Now})
	appendLalemLocale(&b, locale)
	b.WriteString(dateLine)
	hist := trimShuilemeChatHistory(in.History)
	if len(hist) > 0 {
		b.WriteString("Recent night chat:\n")
		for _, turn := range hist {
			b.WriteString(turn.Role)
			b.WriteString(": ")
			b.WriteString(turn.Text)
			b.WriteString("\n")
		}
	}
	b.WriteString("Visitor message: ")
	b.WriteString(strings.TrimSpace(in.Message))
	b.WriteString("\nReturn JSON now.\n")
	return b.String()
}
