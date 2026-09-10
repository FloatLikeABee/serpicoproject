package ai

import (
	"fmt"
	"strings"
)

const fridgeRaidSystemPrompt = `You are Fridge Raid (翻冰箱), a culinary kitchen advisor.

TCM CULINARY THEORY (food as cooking, never as clinical medicine):
- Four natures 寒 热 温 凉: match food nature to the season and weather.
- Five flavors 酸 苦 甘 辛 咸: use them for taste and everyday balance.
- Seasonal correspondence at culinary granularity: 春养肝, 夏养心, 长夏化湿, 秋润肺, 冬温肾.
- Rank dishes: deliciousness first in the hook (appetite / 开胃 — sour or aromatic), then light nutrition and seasonal fit. TCM is a short note, not the first sentence.

OUTPUT:
- Return JSON only matching the fridge-raid card schema. No markdown essay.
- 2–4 suggestion cards.
- Each hook: at most two sentences, about taste or appetite — never a TCM lecture as sentence one.
- Each tcmNote: at most two sentences.
- Prefer leftover ingredients; need[] at most two pantry extras.
- One locale for body copy. Do not write bilingual duplicate paragraphs.
- Never diagnose disease, prescribe treatment, or claim to cure conditions. Culinary wellness only.

JSON keys: season, solarTerm, weather {label, tempC}, ingredientsSeen, askFridgeRaid, nudge, suggestions[{title,titleAlias,hook,chips,tcmNote,uses,need}], disclaimer, locale.
JSON types (strict): askFridgeRaid is a boolean not a string; ingredientsSeen, chips, uses, and need are JSON arrays of strings; weather.tempC is a number.
`

type FridgeRaidPromptInput struct {
	Locale        string
	Leftovers     string
	Plan          string
	Season        SeasonInfo
	Weather       *WeatherSnapshot
	SeenFromPhoto []string
}

func BuildFridgeRaidPrompt(in FridgeRaidPromptInput) string {
	var b strings.Builder
	b.WriteString(fridgeRaidSystemPrompt)
	b.WriteString("\n")
	locale := normalizeFridgeLocale(in.Locale)
	if locale == "cn" {
		b.WriteString("Reply locale: Simplified Chinese only (locale=cn).\n")
	} else {
		b.WriteString("Reply locale: English only (locale=en). You may put a short Chinese dish alias in titleAlias.\n")
	}
	b.WriteString(fmt.Sprintf("Season: %s", in.Season.Name))
	if in.Season.SolarTerm != "" {
		b.WriteString(fmt.Sprintf("  solarTerm: %s", in.Season.SolarTerm))
	}
	b.WriteString("\n")
	if in.Weather != nil && !in.Weather.Unavailable && in.Weather.Label != "" {
		b.WriteString(fmt.Sprintf("Weather (TCM climate): %s tempC=%.1f\n", in.Weather.Label, in.Weather.TempC))
	} else {
		b.WriteString("Weather unavailable — use calendar season only.\n")
	}
	if len(in.SeenFromPhoto) > 0 {
		b.WriteString("Ingredients seen in fridge photo: " + strings.Join(in.SeenFromPhoto, ", ") + "\n")
	}
	if strings.TrimSpace(in.Leftovers) != "" {
		b.WriteString("Leftovers / fridge text: " + strings.TrimSpace(in.Leftovers) + "\n")
	}
	if strings.TrimSpace(in.Plan) != "" {
		b.WriteString("Cooking plan (must respect this): " + strings.TrimSpace(in.Plan) + "\n")
	}
	if strings.TrimSpace(in.Leftovers) == "" && len(in.SeenFromPhoto) == 0 {
		b.WriteString("No fridge contents yet. Set askFridgeRaid=true and a short nudge to raid the fridge. If a plan is present, still request what is on hand.\n")
	}
	b.WriteString("Return JSON now.\n")
	return b.String()
}

func normalizeFridgeLocale(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "cn", "zh", "zh-cn", "zh_cn", "zh-hans", "china":
		return "cn"
	default:
		return "en"
	}
}

func fridgeDisclaimer(locale string) string {
	if normalizeFridgeLocale(locale) == "cn" {
		return "时令饮食建议，不能替代医疗诊断或治疗。"
	}
	return "Culinary TCM-inspired ideas, not medical advice."
}

const fridgeRaidDetailSystemPrompt = `You are Fridge Raid (翻冰箱) writing ONE dish detail card.

TCM CULINARY THEORY (food as cooking, never as clinical medicine):
- Four natures 寒 热 温 凉 and five flavors 酸 苦 甘 辛 咸.
- Rank: cooking steps first, then a taste note, then culinary TCM “good for” (appetite / 开胃, seasonal heat/damp/dry).
- Never diagnose disease, prescribe treatment, or claim to cure conditions. Culinary wellness only.

OUTPUT:
- Return JSON only. No markdown essay.
- steps: 4–8 short cook steps using uses[] and at most the need[] extras.
- tasteNote: at most two sentences about deliciousness.
- tcm.nature, tcm.flavors[], tcm.goodFor[] (culinary / seasonal), tcm.caution[] (food, not clinic).
- One locale. Include disclaimer.

JSON keys: title, titleAlias, steps, tasteNote, tcm {nature, flavors, goodFor, caution}, disclaimer, locale.
JSON types: steps, flavors, goodFor, caution are JSON arrays of strings.
`

type FridgeRaidDetailPromptInput struct {
	Locale     string
	Suggestion FridgeRaidSuggestion
	Season     SeasonInfo
	Weather    *WeatherSnapshot
}

func BuildFridgeRaidDetailPrompt(in FridgeRaidDetailPromptInput) string {
	var b strings.Builder
	b.WriteString(fridgeRaidDetailSystemPrompt)
	b.WriteString("\n")
	locale := normalizeFridgeLocale(in.Locale)
	if locale == "cn" {
		b.WriteString("Reply locale: Simplified Chinese only (locale=cn).\n")
	} else {
		b.WriteString("Reply locale: English only (locale=en).\n")
	}
	b.WriteString(fmt.Sprintf("Season: %s", in.Season.Name))
	if in.Season.SolarTerm != "" {
		b.WriteString(fmt.Sprintf("  solarTerm: %s", in.Season.SolarTerm))
	}
	b.WriteString("\n")
	if in.Weather != nil && !in.Weather.Unavailable && in.Weather.Label != "" {
		b.WriteString(fmt.Sprintf("Weather (TCM climate): %s tempC=%.1f\n", in.Weather.Label, in.Weather.TempC))
	} else {
		b.WriteString("Weather unavailable — use calendar season only.\n")
	}
	sug := in.Suggestion
	b.WriteString("Dish title: " + strings.TrimSpace(sug.Title) + "\n")
	if strings.TrimSpace(sug.TitleAlias) != "" {
		b.WriteString("titleAlias: " + strings.TrimSpace(sug.TitleAlias) + "\n")
	}
	if strings.TrimSpace(sug.Hook) != "" {
		b.WriteString("Taste hook: " + strings.TrimSpace(sug.Hook) + "\n")
	}
	if strings.TrimSpace(sug.TCMNote) != "" {
		b.WriteString("Short TCM peek: " + strings.TrimSpace(sug.TCMNote) + "\n")
	}
	if len(sug.Uses) > 0 {
		b.WriteString("Uses: " + strings.Join(sug.Uses, ", ") + "\n")
	}
	if len(sug.Need) > 0 {
		b.WriteString("Need: " + strings.Join(sug.Need, ", ") + "\n")
	}
	b.WriteString("Return JSON now.\n")
	return b.String()
}
