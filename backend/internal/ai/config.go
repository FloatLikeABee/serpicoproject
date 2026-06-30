package ai

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	GeminiAPIKey        string
	GeminiModel         string
	MistralAPIKey       string
	MistralModel        string
	RAGDataPath         string
	EnableWebSearch     bool
	ChaseGameMaxRounds  int
	ImageProvider       string
	OpenAIAPIKey        string
	OpenAIImageModel    string
	StabilityAPIKey     string
	StabilityImageModel string
	StabilityAPIHost    string
	ReplicateAPIToken   string
	ReplicateImageModel string
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func LoadConfig() *Config {
	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		geminiKey = "AIzaSyDf6KTxtWcWKkir3Q1xoRy8bMZZbqY0rvA"
	}

	mistralKey := os.Getenv("MISTRAL_API_KEY")
	if mistralKey == "" {
		mistralKey = "2IGzr4XnznEjh3O3vs0wFf0lwh7r7yhU"
	}

	return &Config{
		GeminiAPIKey:        geminiKey,
		GeminiModel:         envOrDefault("GEMINI_MODEL", envOrDefault("GEMINI_DEFAULT_MODEL", "gemini-2.5-flash")),
		MistralAPIKey:       mistralKey,
		MistralModel:        envOrDefault("MISTRAL_MODEL", "mistral-large-latest"),
		RAGDataPath:         envOrDefault("RAG_DATA_PATH", "data/rag"),
		EnableWebSearch:     envBool("ENABLE_WEB_SEARCH", true),
		ChaseGameMaxRounds:  envInt("CHASE_GAME_MAX_ROUNDS", 4),
		ImageProvider:       envOrDefault("IMAGE_PROVIDER", "placeholder"),
		OpenAIAPIKey:        os.Getenv("OPENAI_API_KEY"),
		OpenAIImageModel:    envOrDefault("OPENAI_IMAGE_MODEL", "dall-e-3"),
		StabilityAPIKey:     os.Getenv("STABILITY_API_KEY"),
		StabilityImageModel: envOrDefault("STABILITY_IMAGE_MODEL", "stable-diffusion-xl-1024-v1-0"),
		StabilityAPIHost:    envOrDefault("STABILITY_API_HOST", "https://api.stability.ai"),
		ReplicateAPIToken:   os.Getenv("REPLICATE_API_TOKEN"),
		ReplicateImageModel: envOrDefault("REPLICATE_IMAGE_MODEL", "black-forest-labs/flux-schnell"),
	}
}

