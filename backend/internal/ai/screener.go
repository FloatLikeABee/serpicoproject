package ai

import (
	"strings"
)

// PromptScreener filters out unwanted prompts before calling the AI API
type PromptScreener struct {
	blockedPatterns []string
	contextKeywords []string
}

func NewPromptScreener() *PromptScreener {
	return &PromptScreener{
		blockedPatterns: []string{
			"hello", "hi", "hey", "what's up", "how are you", "how's it going",
			"tell me a joke", "sing a song", "what's the weather",
			"random", "nonsense", "asdf", "qwerty", "test test test",
		},
		contextKeywords: []string{
			"olathe", "police", "officer", "perp", "suspect", "case", "crime",
			"pursuit", "arrest", "emergency", "dispatch", "patrol", "investigation",
			"criminal", "robbery", "assault", "murder", "theft", "burglary",
			"location", "address", "vehicle", "strategy", "history", "data",
			"help", "assist", "recommend", "suggest", "query", "search", "find",
		},
	}
}

// ScreenPrompt checks if the prompt should be processed
// Returns: (shouldProcess, reason)
func (s *PromptScreener) ScreenPrompt(prompt string) (bool, string) {
	promptLower := strings.ToLower(strings.TrimSpace(prompt))

	// Check for empty or very short prompts
	if len(promptLower) < 3 {
		return false, "Prompt too short"
	}

	// Check for blocked patterns (chitchat, jibberish)
	for _, pattern := range s.blockedPatterns {
		if strings.Contains(promptLower, pattern) {
			// Check if it's just chitchat without context
			if !s.hasContextKeywords(promptLower) {
				return false, "Contains blocked pattern: " + pattern
			}
		}
	}

	// Check for context relevance
	if !s.hasContextKeywords(promptLower) {
		// Check if it's a valid question format
		if !s.isValidQuestion(promptLower) {
			return false, "No relevant context keywords found"
		}
	}

	// Check for jibberish (repeated characters, random strings)
	if s.isJibberish(promptLower) {
		return false, "Detected jibberish"
	}

	return true, ""
}

func (s *PromptScreener) hasContextKeywords(prompt string) bool {
	for _, keyword := range s.contextKeywords {
		if strings.Contains(prompt, keyword) {
			return true
		}
	}
	return false
}

func (s *PromptScreener) isValidQuestion(prompt string) bool {
	questionWords := []string{"what", "where", "when", "who", "why", "how", "which", "can", "could", "should", "is", "are", "do", "does", "did"}
	for _, word := range questionWords {
		if strings.HasPrefix(prompt, word+" ") {
			return true
		}
	}
	return false
}

func (s *PromptScreener) isJibberish(prompt string) bool {
	// Check for excessive repeated characters
	if len(prompt) > 5 {
		repeats := 0
		for i := 1; i < len(prompt); i++ {
			if prompt[i] == prompt[i-1] {
				repeats++
				if repeats > 3 {
					return true
				}
			} else {
				repeats = 0
			}
		}
	}

	// Check for random character sequences
	randomPatterns := []string{"asdf", "qwerty", "zxcv", "hjkl", "12345", "abcde"}
	for _, pattern := range randomPatterns {
		if strings.Contains(prompt, pattern) {
			return true
		}
	}

	return false
}

