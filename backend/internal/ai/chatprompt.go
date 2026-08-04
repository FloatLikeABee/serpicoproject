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
- Never fabricate case numbers, arrests, or live incident details.

INTEL SOURCE PRIORITY (strict):
1. Admin-curated knowledge (RAG / department records) — highest authority.
2. Admin-collected news digests (Markdown briefs from backstage collection) — highest authority for recent crime news/cases.
3. Supplemental web search — use ONLY to fill gaps. Never override or contradict admin-curated RAG or digest material when they cover the topic.
- Prefer citing admin sources. If admin intel answers the query, lead with that and treat web search as optional backup.`

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
	"in-pursue-place": true,
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

	// Place-tag enrichment always wants live lookup.
	if context == "in-pursue-place" {
		return true
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
		"in-pursue":          "Active pursuit / pursuit exam operations",
		"in-pursue-place":    "Map place-tag location research",
		"perps-cases":        "Suspect and case library research",
		"perps":              "Suspect intelligence",
		"case-library":       "Historical case files",
		"mysteries":          "Cold cases and unsolved investigations",
		"leisure":            "Investigative research (off-duty)",
		"nearby-officers":    "Unit locations and officer availability",
		"nearby-perps":       "Recent criminal activity in the area",
		"safe-routes":        "Route safety based on crime patterns",
		"chase-game":            "Pursuit training / Chase Game",
		"suspect-interview":     "Suspect interview coaching (PEACE / SUE)",
		"investigation-helper":  "Crime-scene investigation brainstorm + interview questions",
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
	b.WriteString("### PRIORITY 1 — Admin knowledge base (RAG)\n")
	b.WriteString("Use these records first. Docs tagged auto_intel came from backstage AI collection.\n")
	for i, doc := range ragDocs {
		origin := "department"
		for _, tag := range doc.Tags {
			if strings.EqualFold(tag, "auto_intel") {
				origin = "admin-collection"
				break
			}
		}
		b.WriteString(fmt.Sprintf("\n**[%d] %s** — %s · %s\n", i+1, doc.Title, doc.Category, origin))
		if doc.Location != "" {
			b.WriteString(fmt.Sprintf("- Location: %s\n", doc.Location))
		}
		if len(doc.Tags) > 0 {
			b.WriteString(fmt.Sprintf("- Tags: %s\n", strings.Join(doc.Tags, ", ")))
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
// Source order is intentional: admin RAG + admin MD digests first, web search last.
func BuildChatPrompt(userMessage, context string, history []ChatHistoryMessage, ragDocs []RAGDocument, webSearchResult, newsDigests string) string {
	var b strings.Builder
	b.WriteString(officerChatSystemPrompt)
	b.WriteString("\n\n")

	if isSuspectInterviewContext(context) {
		b.WriteString(suspectInterviewPrompt)
		b.WriteString("\n\n")
	}
	if isInvestigationHelperContext(context) {
		b.WriteString(investigationHelperPrompt)
		b.WriteString("\n\n")
	}

	if context != "" {
		b.WriteString(fmt.Sprintf("**Operational context:** %s\n\n", contextLabel(context)))
	}

	if histStr := buildHistoryContextString(history); histStr != "" {
		b.WriteString(histStr)
		b.WriteString("\n\n")
	}

	// Priority 1a — admin RAG (includes backstage-collected knowledge)
	if ragStr := buildRAGContextString(ragDocs); ragStr != "" {
		b.WriteString(ragStr)
		b.WriteString("\n\n")
	}

	// Priority 1b — admin MD news digests from backstage collection
	if newsDigests != "" {
		b.WriteString(newsDigests)
		b.WriteString("\n\n")
	}

	// Priority 2 — supplemental web search only
	if webSearchResult != "" {
		b.WriteString("### PRIORITY 2 — Supplemental web search (secondary)\n")
		b.WriteString("Use only if admin RAG/digests do not already cover the question. Do not override admin intel.\n")
		b.WriteString(webSearchResult)
		b.WriteString("\n\n")
	}

	if isSuspectInterviewContext(context) {
		b.WriteString("**Officer turn (case brief required first; later: Suspect answer + Officer thoughts):** ")
		b.WriteString(userMessage)
		b.WriteString("\n\nRespond in Markdown as Officer Serpico using the Suspect Interview Helper rules. If no usable case brief is in this turn or prior conversation, ask for the case brief only — do not give interview questions yet.")
	} else if isInvestigationHelperContext(context) {
		b.WriteString("**Investigation Helper turn:** ")
		b.WriteString(userMessage)
		b.WriteString("\n\nRespond in Markdown as Officer Serpico in Investigation Helper brainstorm mode. Help investigate and draft interview questions when useful.")
	} else {
		b.WriteString("**Officer query:** ")
		b.WriteString(userMessage)
		b.WriteString("\n\nRespond in Markdown as Officer Serpico. Prefer admin-curated RAG and digests over web search.")
	}

	return b.String()
}
