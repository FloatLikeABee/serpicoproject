package ai

import (
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
	return context == "in-pursue-place"
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

func ragDocMatchesPlace(doc RAGDocument, haystack string) bool {
	h := normalizePlaceText(haystack)
	if h == "" {
		return false
	}
	loc := strings.TrimSpace(doc.Location)
	if loc == "" || strings.EqualFold(loc, "general") {
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

func buildPlaceTagChatPrompt(userMessage string, history []ChatHistoryMessage, ragDocs []RAGDocument, webSearchResult string) string {
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
	b.WriteString("\n\nRespond in Markdown as Officer Serpico. Write only about this pin's address and city. Do not mention Olathe or Kansas unless that is the pin address. Do not dump another city's crime statistics.")
	return b.String()
}
