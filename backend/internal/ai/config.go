package ai

import (
	"os"
)

type Config struct {
	GeminiAPIKey     string
	GeminiModel      string
	MistralAPIKey    string
	MistralModel     string
	RAGDataPath      string
	EnableWebSearch  bool
}

func LoadConfig() *Config {
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		geminiKey = "AIzaSyDf6KTxtWcWKkir3Q1xoRy8bMZZbqY0rvA"
	}

	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-2.5-flash"
	}

	mistralKey := os.Getenv("MISTRAL_API_KEY")
	if mistralKey == "" {
		mistralKey = "2IGzr4XnznEjh3O3vs0wFf0lwh7r7yhU"
	}

	mistralModel := os.Getenv("MISTRAL_MODEL")
	if mistralModel == "" {
		mistralModel = "mistral-large-latest"
	}

	return &Config{
		GeminiAPIKey:    geminiKey,
		GeminiModel:     geminiModel,
		MistralAPIKey:   mistralKey,
		MistralModel:    mistralModel,
		RAGDataPath:     "data/rag",
		EnableWebSearch: true,
	}
}

