package ai

import (
	"fmt"
	"strings"
	"unicode"
)

const placeTagChatSystemPrompt = `You are Officer Serpico, an AI field advisor writing a short intel brief for a single map pin.

VOICE & TONE:
- Speak like a professional law enforcement officer: direct, calm, and operationally focused.
- Use clear radio-style brevity when it fits (e.g. "Copy that", "10-4", "Heads up").
- Be respectful and helpful. Prioritize officer safety and actionable next checks.

FORMATTING:
- Format EVERY response in clean Markdown.
- Use **bold** for key terms, locations, and action items.
- Use bullet lists for intel and suggested next checks.
- Use ### headings to organize longer responses.
- Do not wrap the entire response in a code block.

GEOGRAPHIC SCOPE (strict):
- The pin ADDRESS, CITY / JURISDICTION, and COORDINATES in the officer query are the only valid location.
- Do not mention Olathe, Kansas, Olathe PD, or any other city unless that city is this pin's address.
- Ignore department records, news digests, and search hits about a different city or jurisdiction.
- Never paste crime statistics, hotspots, or blotter data from a jurisdiction that is not the pin's city.
- If you lack specific records for this address, say so plainly and give neighborhood/city context for THIS pin only.

CONTENT:
- Ground the brief in the pin type, name, officer notes, and this location.
- Never fabricate case numbers, arrests, or live incident details.
- If live search is about a different city, ignore it.`

func isPlaceTagContext(context string) bool {
	return contextSlug(context) == "in-pursue-place"
}

func extractLabeledField(message, label string) string {
	if message == "" || label == "" {
		return ""
	}
	lower := strings.ToLower(message)
	lab := strings.ToLower(strings.TrimSpace(label))
	idx := strings.Index(lower, lab)
	if idx < 0 {
		return ""
	}
	rest := strings.TrimSpace(message[idx+len(lab):])
	if strings.HasPrefix(rest, ":") {
		rest = strings.TrimSpace(rest[1:])
	}
	if nl := strings.IndexAny(rest, "\n\r"); nl >= 0 {
		rest = rest[:nl]
	}
	return strings.TrimSpace(rest)
}

func placeTagLocationHaystack(userMessage string) string {
	var parts []string
	labels := []string{
		"ADDRESS:",
		"Address / place:",
		"PIN ADDRESS:",
		"CITY / JURISDICTION:",
		"CITY:",
		"COORDINATES:",
		"Coordinates:",
	}
	for _, label := range labels {
		if v := extractLabeledField(userMessage, label); v != "" {
			parts = append(parts, v)
		}
	}
	if len(parts) == 0 {
		return userMessage
	}
	return strings.Join(parts, " ")
}

func isPlaceTagExcludedRAG(doc RAGDocument) bool {
	cat := strings.ToLower(strings.TrimSpace(doc.Category))
	switch cat {
	case "chase-game", "chase", "strategy", "tactics":
		return true
	}
	for _, tag := range doc.Tags {
		t := strings.ToLower(strings.TrimSpace(tag))
		if t == "chase" || t == "game" || t == "codex" {
			return true
		}
	}
	return false
}

func ragDocMatchesPlace(doc RAGDocument, haystack string) bool {
	if isPlaceTagExcludedRAG(doc) {
		return false
	}
	h := normalizePlaceText(haystack)
	if h == "" {
		return false
	}
	loc := strings.TrimSpace(doc.Location)
	if loc == "" || strings.EqualFold(loc, "general") || strings.EqualFold(loc, "national") {
		return false
	}
	normLoc := normalizePlaceText(loc)
	if normLoc != "" && strings.Contains(h, normLoc) {
		return true
	}
	city := strings.TrimSpace(strings.Split(loc, ",")[0])
	normCity := normalizePlaceText(city)
	if len(normCity) < 4 {
		return false
	}
	return strings.Contains(h, normCity)
}

func filterRAGDocsForPlace(docs []RAGDocument, userMessage string) []RAGDocument {
	haystack := placeTagLocationHaystack(userMessage)
	out := make([]RAGDocument, 0, len(docs))
	seen := make(map[string]bool)
	for _, doc := range docs {
		if !ragDocMatchesPlace(doc, haystack) {
			continue
		}
		if doc.ID != "" && seen[doc.ID] {
			continue
		}
		if doc.ID != "" {
			seen[doc.ID] = true
		}
		out = append(out, doc)
	}
	return out
}

func placeTagWebQuery(userMessage string) string {
	address := firstLabeledField(userMessage, []string{
		"ADDRESS:",
		"Address / place:",
		"PIN ADDRESS:",
	})
	city := firstLabeledField(userMessage, []string{
		"CITY / JURISDICTION:",
		"CITY:",
	})
	kind := firstLabeledField(userMessage, []string{
		"PIN TYPE:",
		"Tag type:",
	})
	name := firstLabeledField(userMessage, []string{
		"NAME:",
		"Name:",
	})

	var bits []string
	switch {
	case address != "":
		bits = append(bits, address)
	case city != "":
		bits = append(bits, city)
	default:
		bits = append(bits, compactQuery(placeTagLocationHaystack(userMessage), 80))
	}
	if kind != "" {
		bits = append(bits, kind)
	}
	if name != "" {
		bits = append(bits, name)
	}
	bits = append(bits, "neighborhood crime police")
	return compactQuery(strings.Join(bits, " "), 180)
}

func firstLabeledField(message string, labels []string) string {
	for _, label := range labels {
		if v := extractLabeledField(message, label); v != "" {
			return v
		}
	}
	return ""
}

func compactQuery(s string, max int) string {
	s = strings.Join(strings.Fields(s), " ")
	if max > 0 && len(s) > max {
		s = strings.TrimSpace(s[:max])
	}
	return s
}

func normalizePlaceText(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	if s == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(s))
	lastSpace := false
	for _, r := range s {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(unicode.ToLower(r))
			lastSpace = false
			continue
		}
		if !lastSpace {
			b.WriteByte(' ')
			lastSpace = true
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func buildPlaceTagChatPrompt(userMessage string, history []ChatHistoryMessage, ragDocs []RAGDocument, webSearchResult, context string) string {
	var b strings.Builder
	b.WriteString(placeTagChatSystemPrompt)
	b.WriteString("\n\n")
	b.WriteString("**Operational context:** Map place-tag location research\n\n")

	if histStr := buildHistoryContextString(history); histStr != "" {
		b.WriteString(histStr)
		b.WriteString("\n\n")
	}

	if ragStr := buildRAGContextString(ragDocs); ragStr != "" {
		b.WriteString("Department records below are already filtered to this pin's city. Ignore any that still look like a different jurisdiction.\n")
		b.WriteString(ragStr)
		b.WriteString("\n\n")
	}

	if webSearchResult != "" {
		b.WriteString("### Live search for this pin\n")
		b.WriteString("Use these headlines only if they match the pin's city or neighborhood. Ignore other cities.\n")
		b.WriteString(webSearchResult)
		b.WriteString("\n\n")
	}

	b.WriteString("**Officer query:** ")
	b.WriteString(userMessage)
	b.WriteString("\n\nRespond in Markdown as Officer Serpico. Write only about this pin's address, name, and notes. Do not paste department pursuit protocols, chase-game codex, or crime stats unless they are specifically about this pin's city. Do not mention Olathe or Kansas unless that is the pin address.")
	if nationFromContext(context) == "cn" {
		b.WriteString("\n")
		b.WriteString(PlaceTagLanguageSuffix("cn"))
	}
	return b.String()
}

func fallbackPlain(value, empty string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return empty
	}
	return value
}

func generatePlaceTagFallback(query, webResult string) string {
	kind := firstLabeledField(query, []string{"PIN TYPE:", "Tag type:"})
	name := firstLabeledField(query, []string{"NAME:", "Name:"})
	address := firstLabeledField(query, []string{"ADDRESS:", "Address / place:", "PIN ADDRESS:"})
	city := firstLabeledField(query, []string{"CITY / JURISDICTION:", "CITY:"})
	notes := firstLabeledField(query, []string{"OFFICER NOTES:", "Officer notes so far:"})
	coords := firstLabeledField(query, []string{"COORDINATES:", "Coordinates:"})

	loc := address
	if loc == "" {
		loc = city
	}
	if loc == "" {
		loc = coords
	}
	if loc == "" {
		loc = "this pin"
	}

	var b strings.Builder
	b.WriteString("**Copy that.** Live model lookup is down, so this is a field brief from the pin you entered — not department records.\n\n")
	b.WriteString(fmt.Sprintf("- **%s:** %s\n", fallbackPlain(kind, "Map tag"), fallbackPlain(name, "unnamed")))
	b.WriteString(fmt.Sprintf("- **Location:** %s\n", loc))
	if notes != "" {
		b.WriteString(fmt.Sprintf("- **Officer notes:** %s\n", notes))
	}
	if strings.TrimSpace(webResult) != "" && !strings.Contains(strings.ToLower(webResult), "rely on admin rag") {
		b.WriteString("\n### Headlines for this address\n")
		b.WriteString(strings.TrimSpace(webResult))
		b.WriteString("\n")
	}
	b.WriteString("\n**Suggested next checks**\n")
	b.WriteString("- Confirm this address with local dispatch for this city.\n")
	b.WriteString("- Canvas nearby cameras and businesses using the notes as the behavior window.\n")
	b.WriteString("- Retry **Create AI info** for a live neighborhood brief.\n")
	b.WriteString("\n*Intel may be incomplete — confirm through official channels before action.*")
	return b.String()
}
