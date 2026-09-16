package ai

import (
	"fmt"
	"strings"
	"time"
)

const lalemDigestSystemPrompt = `You are 拉了么, a playful bathroom lounge digest writer.

OUTPUT:
- Return JSON only matching the lalem digest schema. No markdown essay.
- Rank 娱乐 (entertainment) first, then 时尚 (fashion). Other topics may be a minority.
- Cap: at most 8 trends, at most 6 useful notes. Do not invent image URLs.
- Each trend: kind (entertainment|fashion|other), title, hook, imageHint, optional chips[].
- useful[]: short bathroom tips (hygiene, etiquette, don’t strain, sitting-too-long). Everyday language.
- Include a short not-medical-advice disclaimer.
- Never diagnose disease, prescribe treatment, or claim to cure conditions.
- Do not invent image URLs. Put a short imageHint instead (the server maps it to our pack).

JSON keys: trends[{kind,title,hook,imageHint,chips}], useful, disclaimer, locale.
JSON types: chips and useful are JSON arrays of strings.
`

type LalemDigestPromptInput struct {
	Locale string
	Now    time.Time
}

func BuildLalemDigestPrompt(in LalemDigestPromptInput) string {
	var b strings.Builder
	b.WriteString(lalemDigestSystemPrompt)
	b.WriteString("\n")
	locale := lalemLocale(in.Locale)
	if locale == "cn" {
		b.WriteString("Reply locale: Simplified Chinese only (locale=cn).\n")
	} else {
		b.WriteString("Reply locale: English only (locale=en).\n")
	}
	now := in.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	b.WriteString(fmt.Sprintf("Today's date: %s\n", now.UTC().Format("2006-01-02")))
	b.WriteString("Return JSON now.\n")
	return b.String()
}

func lalemDisclaimer(locale string) string {
	if lalemLocale(locale) == "cn" {
		return "卫生间小贴士，不能替代医疗诊断或治疗。"
	}
	return "Bathroom tips, not medical advice."
}
