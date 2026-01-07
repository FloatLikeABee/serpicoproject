package ai

import (
	"math"
)

// EmbeddingService handles text embeddings using Gemini API
// Note: Currently uses simple hash-based embeddings
// For production, integrate with OpenAI text-embedding-ada-002 or similar
type EmbeddingService struct {
	apiKey string
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(apiKey string) *EmbeddingService {
	return &EmbeddingService{
		apiKey: apiKey,
	}
}

// EmbeddingRequest represents a request to generate embeddings
type EmbeddingRequest struct {
	Model string `json:"model"`
	Task  string `json:"task"`
	Text  string `json:"text"`
}

// EmbeddingResponse represents the response from the embedding API
type EmbeddingResponse struct {
	Embedding EmbeddingData `json:"embedding"`
}

type EmbeddingData struct {
	Values []float64 `json:"values"`
}

// GenerateEmbedding generates an embedding vector for the given text
func (e *EmbeddingService) GenerateEmbedding(text string) ([]float64, error) {
	// Use Gemini's embedding model
	// Note: Gemini doesn't have a dedicated embedding API, so we'll use a workaround
	// For production, consider using OpenAI's text-embedding-ada-002 or similar
	
	// For now, we'll create a simple embedding using text hashing
	// In production, replace this with actual embedding API call
	embedding := e.simpleEmbedding(text)
	return embedding, nil
}

// simpleEmbedding creates a simple embedding vector (placeholder)
// In production, replace with actual embedding API
func (e *EmbeddingService) simpleEmbedding(text string) []float64 {
	// Create a 384-dimensional embedding using text features
	// This is a simplified approach - in production use actual embedding API
	dim := 384
	embedding := make([]float64, dim)
	
	// Simple hash-based embedding
	hash := 0
	for _, char := range text {
		hash = hash*31 + int(char)
	}
	
	// Fill embedding with values based on hash
	for i := 0; i < dim; i++ {
		val := float64((hash+i*17)%1000) / 1000.0
		embedding[i] = val*2 - 1 // Normalize to [-1, 1]
	}
	
	return embedding
}

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0.0
	}

	var dotProduct, normA, normB float64
	for i := 0; i < len(a); i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// TryGeminiEmbedding attempts to use Gemini API for embeddings
// This is a placeholder - Gemini doesn't have a dedicated embedding endpoint
// In production, use OpenAI's text-embedding-ada-002 or similar
func (e *EmbeddingService) TryGeminiEmbedding(text string) ([]float64, error) {
	// For now, return simple embedding
	// In production, integrate with actual embedding service
	return e.simpleEmbedding(text), nil
}

// VectorSearch performs vector similarity search
func VectorSearch(queryEmbedding []float64, documents []RAGDocumentWithEmbedding, limit int) []RAGDocumentWithEmbedding {
	if limit <= 0 {
		limit = 5
	}

	type scoredDoc struct {
		doc   RAGDocumentWithEmbedding
		score float64
	}

	scoredDocs := make([]scoredDoc, 0)

	for _, doc := range documents {
		if len(doc.Embedding) == 0 {
			continue
		}
		score := CosineSimilarity(queryEmbedding, doc.Embedding)
		scoredDocs = append(scoredDocs, scoredDoc{
			doc:   doc,
			score: score,
		})
	}

	// Sort by score (descending)
	for i := 0; i < len(scoredDocs)-1; i++ {
		for j := i + 1; j < len(scoredDocs); j++ {
			if scoredDocs[i].score < scoredDocs[j].score {
				scoredDocs[i], scoredDocs[j] = scoredDocs[j], scoredDocs[i]
			}
		}
	}

	// Return top results
	results := make([]RAGDocumentWithEmbedding, 0)
	for i := 0; i < limit && i < len(scoredDocs); i++ {
		results = append(results, scoredDocs[i].doc)
	}

	return results
}

// RAGDocumentWithEmbedding extends RAGDocument with embedding
type RAGDocumentWithEmbedding struct {
	RAGDocument
	Embedding []float64 `json:"embedding"`
}

// Note: For production use, consider integrating with:
// - OpenAI text-embedding-ada-002
// - Cohere embedding API
// - Hugging Face sentence transformers
// - Or use a vector database like Qdrant, Pinecone, or Weaviate

