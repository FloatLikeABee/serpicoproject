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

const lalemIncrementSystemPrompt = `You are 拉了么, a playful bathroom lounge digest writer.

OUTPUT:
- Return JSON only matching the lalem digest schema. No markdown essay.
- Add exactly two new 娱乐/时尚 trend cards (entertainment then fashion). No extra trends.
- Add exactly one new useful bathroom note.
- Do not invent image URLs. Put a short imageHint instead (the server maps it to our pack).
- useful[]: one short bathroom tip (hygiene, etiquette, don’t strain, sitting-too-long). Everyday language.
- Include a short not-medical-advice disclaimer.
- Never diagnose disease, prescribe treatment, or claim to cure conditions.

JSON keys: trends[{kind,title,hook,imageHint,chips}], useful, disclaimer, locale.
JSON types: chips and useful are JSON arrays of strings.
`

type LalemDigestPromptInput struct {
	Locale string
	Now    time.Time
}

func lalemPromptLocaleDate(in LalemDigestPromptInput) (locale string, dateLine string) {
	locale = lalemLocale(in.Locale)
	now := in.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}
	return locale, fmt.Sprintf("Today's date: %s\n", now.UTC().Format("2006-01-02"))
}

func appendLalemLocale(b *strings.Builder, locale string) {
	if locale == "cn" {
		b.WriteString("Reply locale: Simplified Chinese only (locale=cn).\n")
	} else {
		b.WriteString("Reply locale: English only (locale=en).\n")
	}
}

func BuildLalemDigestPrompt(in LalemDigestPromptInput) string {
	var b strings.Builder
	b.WriteString(lalemDigestSystemPrompt)
	b.WriteString("\n")
	locale, dateLine := lalemPromptLocaleDate(in)
	appendLalemLocale(&b, locale)
	b.WriteString(dateLine)
	b.WriteString("Return JSON now.\n")
	return b.String()
}

func BuildLalemIncrementPrompt(in LalemDigestPromptInput) string {
	var b strings.Builder
	b.WriteString(lalemIncrementSystemPrompt)
	b.WriteString("\n")
	locale, dateLine := lalemPromptLocaleDate(in)
	appendLalemLocale(&b, locale)
	b.WriteString(dateLine)
	b.WriteString("Return JSON now.\n")
	return b.String()
}

func lalemDisclaimer(locale string) string {
	if lalemLocale(locale) == "cn" {
		return "卫生间小贴士，不能替代医疗诊断或治疗。"
	}
	return "Bathroom tips, not medical advice."
}

// ComposeStoredLalemDigest builds a public digest from kept SQLite rows. Videos stay off 拉榜.
func ComposeStoredLalemDigest(locale string, trends []LalemTrend, useful []string, generatedAt string) *LalemDigest {
	locale = lalemLocale(locale)
	if strings.TrimSpace(generatedAt) == "" {
		generatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	mapped := make([]LalemTrend, len(trends))
	copy(mapped, trends)
	for i := range mapped {
		mapped[i].TopicID = MapLalemTrendTopic(mapped[i].Title, mapped[i].Hook, mapped[i].TopicID)
		mapped[i].ImageURL = RewriteLalemTrendImage(mapped[i].ImageURL)
	}
	return &LalemDigest{
		GeneratedAt: generatedAt,
		Locale:      locale,
		Disclaimer:  lalemDisclaimer(locale),
		Trends:      mapped,
		Useful:      useful,
		Videos:      []LalemVideo{},
	}
}
