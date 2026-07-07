package ai

import (
	"fmt"
	"strings"
)

const officerChatSystemPrompt = `You are Officer Serpico, an AI field advisor assigned to the Olathe Police Department.

VOICE & TONE:
- Speak like a professional law enforcement officer: direct, calm, and operationally focused.
- Use clear radio-style brevity when it fits (e.g., "Copy that", "10-4", "Heads up").
- Be respectful and helpful to fellow officers and authorized personnel.
- Prioritize officer safety, situational awareness, and actionable guidance.

FORMATTING:
- Format EVERY response in clean Markdown.
- Use **bold** for key terms, locations, suspect IDs, and action items.
- Use bullet lists or numbered steps for tactics, timelines, and intel briefs.
- Use ### headings to organize longer responses.
- Do not wrap the entire response in a code block.

CONTENT:
- Ground answers in provided department records and live intel when available.
- If intel is insufficient, say so plainly and recommend next steps.
- Never fabricate case numbers, arrests, or live incident details.`

var crimeDataKeywords = []string{
	"crime", "criminal", "arrest", "arrests", "suspect", "suspects", "perp", "perps",
	"perpetrator", "robbery", "homicide", "murder", "assault", "theft", "burglary",
	"shooting", "stabbing", "warrant", "fugitive", "case", "cases", "investigation",
	"incident", "hotspot", "hot spot", "blotter", "felony", "misdemeanor",
	"serial killer", "kidnapping", "abduction", "gang", "narcotics", "dui",
	"domestic", "pursuit", "chase", "wanted", "offender", "convicted", "charges",
	"crime rate", "crime data", "crime stat", "recent activity", "police report",
	"active pursuit", "subject", "bolo", "intel", "dispatch",
}

var infoSeekingPhrases = []string{
	"show me", "find", "search", "lookup", "look up", "what are", "what is", "what do",
	"where is", "where are", "who is", "who are", "how many", "list", "tell me",
	"any recent", "any active", "latest", "current", "recent", "update on",
	"status of", "information about", "info on", "data on", "report on",
}

var crimeDataContexts = map[string]bool{
	"in-pursue":       true,
	"perps-cases":     true,
	"perps":           true,
	"case-library":    true,
	"nearby-perps":    true,
	"safe-routes":     true,
	"nearby-officers": true,
}

// NeedsCrimeDataWebSearch returns true when the user's message likely requires live crime intel.
func NeedsCrimeDataWebSearch(message, context string) bool {
	lower := strings.ToLower(strings.TrimSpace(message))
	if len(lower) < 4 {
		return false
	}

	for _, kw := range crimeDataKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}

	if !crimeDataContexts[context] {
		return false
	}

	for _, phrase := range infoSeekingPhrases {
		if strings.Contains(lower, phrase) {
			return true
		}
	}

	return false
}

func contextLabel(context string) string {
	labels := map[string]string{
		"in-pursue":       "Active pursuit / pursuit exam operations",
		"perps-cases":     "Suspect and case library research",
		"perps":           "Suspect intelligence",
		"case-library":    "Historical case files",
		"mysteries":       "Cold cases and unsolved investigations",
		"leisure":         "Investigative research (off-duty)",
		"nearby-officers": "Unit locations and officer availability",
		"nearby-perps":    "Recent criminal activity in the area",
		"safe-routes":     "Route safety based on crime patterns",
		"chase-game":      "Pursuit training / Chase Game",
	}
	if label, ok := labels[context]; ok {
		return label
	}
	if context != "" {
		return context
	}
	return "General department advisory"
}

func buildRAGContextString(ragDocs []RAGDocument) string {
	if len(ragDocs) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("### Department records (RAG)\n")
	for i, doc := range ragDocs {
		b.WriteString(fmt.Sprintf("\n**[%d] %s** — %s\n", i+1, doc.Title, doc.Category))
		if doc.Location != "" {
			b.WriteString(fmt.Sprintf("- Location: %s\n", doc.Location))
		}
		b.WriteString(fmt.Sprintf("- %s\n", doc.Content))
	}
	return b.String()
}

// ChatHistoryMessage is a prior turn in the conversation.
type ChatHistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func buildHistoryContextString(history []ChatHistoryMessage) string {
	if len(history) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("### Prior conversation\n")
	for _, msg := range history {
		role := strings.ToUpper(msg.Role)
		if role != "USER" && role != "ASSISTANT" {
			continue
		}
		b.WriteString(fmt.Sprintf("- **%s:** %s\n", role, msg.Content))
	}
	return b.String()
}

// BuildChatPrompt assembles the full prompt for Gemini/Mistral chat generation.
func BuildChatPrompt(userMessage, context string, history []ChatHistoryMessage, ragDocs []RAGDocument, webSearchResult string) string {
	var b strings.Builder
	b.WriteString(officerChatSystemPrompt)
	b.WriteString("\n\n")

	if context != "" {
		b.WriteString(fmt.Sprintf("**Operational context:** %s\n\n", contextLabel(context)))
	}

	if histStr := buildHistoryContextString(history); histStr != "" {
		b.WriteString(histStr)
		b.WriteString("\n\n")
	}

	if ragStr := buildRAGContextString(ragDocs); ragStr != "" {
		b.WriteString(ragStr)
		b.WriteString("\n\n")
	}

	if webSearchResult != "" {
		b.WriteString("### Live intel (web search — crime data)\n")
		b.WriteString(webSearchResult)
		b.WriteString("\n\n")
	}

	b.WriteString("**Officer query:** ")
	b.WriteString(userMessage)
	b.WriteString("\n\nRespond in Markdown as Officer Serpico.")

	return b.String()
}
