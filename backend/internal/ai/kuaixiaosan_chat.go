package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

type KuaixiaosanChatTurn struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type KuaixiaosanChatInput struct {
	Locale  string
	Message string
	History []KuaixiaosanChatTurn
}

type KuaixiaosanChat struct {
	Reply string `json:"reply"`
}

type KuaixiaosanAdvisor struct {
	Now        time.Time
	CompleteFn func(prompt string) (string, error)
}

func (a *KuaixiaosanAdvisor) now() time.Time {
	if a != nil && !a.Now.IsZero() {
		return a.Now
	}
	return time.Now().UTC()
}

func (a *KuaixiaosanAdvisor) AdviseKuaixiaosanChat(in KuaixiaosanChatInput) (*KuaixiaosanChat, error) {
	locale := lalemLocale(in.Locale)
	msg := strings.TrimSpace(in.Message)
	fallback := pickCannedKuaixiaosanChat(locale, msg, a.now())
	if a == nil || a.CompleteFn == nil {
		return fallback, nil
	}
	raw, err := a.CompleteFn(BuildKuaixiaosanChatPrompt(KuaixiaosanChatPromptInput{
		Locale:  locale,
		Now:     a.now(),
		Message: msg,
		History: trimKuaixiaosanChatHistory(in.History),
	}))
	if err != nil || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	parsed, err := ParseKuaixiaosanChat(raw)
	if err != nil || parsed == nil || strings.TrimSpace(parsed.Reply) == "" || lalemCompanionDiagnostic(parsed.Reply) {
		return fallback, nil
	}
	parsed.Reply = trimKuaixiaosanChatText(parsed.Reply)
	if parsed.Reply == "" || lalemCompanionDiagnostic(parsed.Reply) {
		return fallback, nil
	}
	return parsed, nil
}

func ParseKuaixiaosanChat(raw string) (*KuaixiaosanChat, error) {
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
		return &KuaixiaosanChat{Reply: trimKuaixiaosanChatText(m.Reply)}, nil
	}
	para := trimKuaixiaosanChatText(s)
	if para == "" {
		return nil, fmt.Errorf("empty chat paragraph")
	}
	return &KuaixiaosanChat{Reply: para}, nil
}

func cannedKuaixiaosanChatLines(locale string) []string {
	if lalemLocale(locale) == "cn" {
		return []string{
			"腰更疼还是小腹更疼？先小口喝水，用杯子滤过尿液。发热加腰痛要立刻就医。这不是诊断。",
			"有没有发热或发冷？侧卧休息，热敷后腰。完全无尿时不要等，去急诊。",
			"尿是不是变红或变少？继续小口补水，滤过尿。这是恢复步骤，不是诊断。",
			"做过碎石或输尿管镜了吗？按约定休息，不要猛跑。滤过尿液留给化验。",
			"能不能把水喝下去？吐到喝不进水要立刻急诊。先说现在哪里最不舒服。",
			"疼痛是一阵一阵还是持续？热敷后腰，慢慢走动，滤过尿。这不是处方剂量。",
			"怀孕或只有一侧肾脏时，剧痛要更早去急诊。先说发热、尿量和疼痛位置。",
			"夜里疼醒可以侧卧、小口喝水。不要自己加处方药剂量。感觉怎样，用一句话说。",
		}
	}
	return []string{
		"Where does it hurt more, the flank or the lower belly? Sip water slowly and strain urine. Fever with flank pain means seek emergency care now.",
		"Any fever or chills? Rest on your side and use heat on the back. No urine at all means do not wait — seek emergency care.",
		"Is the urine darker, red, or much less? Keep sipping fluids and straining urine. Recovery steps, not a diagnosis.",
		"After lithotripsy or ureteroscopy? Rest as planned. Do not sprint. Strain urine for later assay.",
		"Can water stay down? Vomiting that blocks fluids means seek emergency care now. Say where it feels worst.",
		"Is the pain in waves or steady? Heat on the back, slow walking, strain urine. This is not a prescription dose.",
		"In pregnancy or with one kidney, severe pain needs earlier emergency care. Name fever, urine amount, and where it hurts.",
		"If pain wakes you at night, lie on the side and sip water. Do not raise a prescription dose. Say how it feels in one line.",
	}
}

func pickCannedKuaixiaosanChat(locale, message string, now time.Time) *KuaixiaosanChat {
	lines := cannedKuaixiaosanChatLines(locale)
	if len(lines) == 0 {
		return &KuaixiaosanChat{Reply: "Sip water slowly and strain urine. This is not a diagnosis."}
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
	return &KuaixiaosanChat{Reply: lines[n%len(lines)]}
}

func trimKuaixiaosanChatHistory(in []KuaixiaosanChatTurn) []KuaixiaosanChatTurn {
	out := make([]KuaixiaosanChatTurn, 0, 6)
	for _, turn := range in {
		role := strings.ToLower(strings.TrimSpace(turn.Role))
		text := strings.TrimSpace(turn.Text)
		if text == "" {
			continue
		}
		if role != "user" && role != "assistant" {
			role = "user"
		}
		out = append(out, KuaixiaosanChatTurn{Role: role, Text: text})
	}
	if len(out) > 6 {
		out = out[len(out)-6:]
	}
	return out
}

func trimKuaixiaosanChatText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	runes := []rune(s)
	if len(runes) > 800 {
		s = string(runes[:800])
	}
	return strings.TrimSpace(s)
}

const kuaixiaosanChatSystemPrompt = `You are 肾结石快消散, a calm kidney-stone encyclopedia nurse-educator.

OUTPUT:
- Return JSON only: {"reply":"..."}
- If the visitor has not said where it hurts, fever, urine change, or after a procedure, ASK one short feeling question first.
- Then give numbered recovery steps: sip fluids, rest, strain urine, heat on the back, when to seek emergency care, post-procedure encyclopedia. No named prescription doses.
- Fever + flank pain, anuria, pregnancy with severe pain, vomiting that blocks fluids → say seek emergency care now, without naming a diagnosis.
- If the visitor asks about police work, leftover cooking, poop, bedtime math, or news, steer back to kidney-stone recovery knowledge.
- Never diagnose. Never say "you have" or "你患有". Never prescribe treatment doses. No URLs. No wikipedia links.
- Tone: steady recovery encyclopedia. This is not medical advice.
`

type KuaixiaosanChatPromptInput struct {
	Locale  string
	Now     time.Time
	Message string
	History []KuaixiaosanChatTurn
}

func BuildKuaixiaosanChatPrompt(in KuaixiaosanChatPromptInput) string {
	var b strings.Builder
	b.WriteString(kuaixiaosanChatSystemPrompt)
	b.WriteString("\n")
	locale, dateLine := lalemPromptLocaleDate(LalemDigestPromptInput{Locale: in.Locale, Now: in.Now})
	appendLalemLocale(&b, locale)
	b.WriteString(dateLine)
	hist := trimKuaixiaosanChatHistory(in.History)
	if len(hist) > 0 {
		b.WriteString("Recent stone-recovery chat:\n")
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
