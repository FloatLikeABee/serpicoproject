package ai

import (
	"os"
)

type Config struct {
	GeminiAPIKey     string
	GeminiModel      string
	RAGDataPath      string
	EnableWebSearch  bool
}

func LoadConfig() *Config {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		apiKey = "AIzaSyAt19tBj232GyyUbM95MlZzZarqZcTKmsc"
	}

	model := os.Getenv("GEMINI_MODEL")
	if model == "" {
		model = "gemini-2.5-flash"
	}

	return &Config{
		GeminiAPIKey:    apiKey,
		GeminiModel:     model,
		RAGDataPath:     "data/rag",
		EnableWebSearch: true,
	}
}

