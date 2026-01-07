package api

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"serpico/backend/internal/ai"
	"serpico/backend/internal/collector"
)

// handleCollectFromURL handles web crawling requests
func handleCollectFromURL(c *gin.Context, aiService *ai.AIService) {
	var req struct {
		URL      string   `json:"url" binding:"required"`
		Category string   `json:"category"`
		Location string   `json:"location"`
		Tags     []string `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create collector
	dataCollector := collector.NewDataCollector(aiService)

	// Collect data from URL
	chunks, err := dataCollector.CollectFromURL(req.URL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to collect from URL: %v", err)})
		return
	}

	if len(chunks) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No content extracted from URL",
			"chunks":  0,
		})
		return
	}

	// Convert to RAG documents
	sourceName := extractDomainFromURL(req.URL)
	if req.Category == "" {
		req.Category = "web_content"
	}

	documents, err := dataCollector.ConvertToRAGDocuments(
		chunks,
		"web",
		sourceName,
		req.Category,
		req.Location,
		req.Tags,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to convert to RAG: %v", err)})
		return
	}

	// Add documents to RAG database
	ragDB := aiService.GetRAGDatabase()
	addedCount := 0
	for _, doc := range documents {
		if err := ragDB.AddDocument(doc); err != nil {
			continue
		}
		addedCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      fmt.Sprintf("Successfully collected and added %d documents", addedCount),
		"chunks_found": len(chunks),
		"documents_added": addedCount,
		"documents":    documents,
	})
}

// handleCollectFromAPI handles API data collection requests
func handleCollectFromAPI(c *gin.Context, aiService *ai.AIService) {
	var req struct {
		APIConfig collector.APIConfig `json:"api_config" binding:"required"`
		Category  string              `json:"category"`
		Location  string              `json:"location"`
		Tags      []string            `json:"tags"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default method
	if req.APIConfig.Method == "" {
		req.APIConfig.Method = "GET"
	}

	// Create collector
	dataCollector := collector.NewDataCollector(aiService)

	// Collect data from API
	data, err := dataCollector.CollectFromAPI(req.APIConfig)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to collect from API: %v", err)})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No data extracted from API",
			"items":   0,
		})
		return
	}

	// Convert to RAG documents
	sourceName := extractDomainFromURL(req.APIConfig.URL)
	if req.Category == "" {
		req.Category = "api_data"
	}

	documents, err := dataCollector.ConvertToRAGDocuments(
		data,
		"api",
		sourceName,
		req.Category,
		req.Location,
		req.Tags,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to convert to RAG: %v", err)})
		return
	}

	// Add documents to RAG database
	ragDB := aiService.GetRAGDatabase()
	addedCount := 0
	for _, doc := range documents {
		if err := ragDB.AddDocument(doc); err != nil {
			continue
		}
		addedCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        fmt.Sprintf("Successfully collected and added %d documents", addedCount),
		"items_found":    len(data),
		"documents_added": addedCount,
		"documents":      documents,
	})
}

// handleCollectFromFile handles file upload requests
func handleCollectFromFile(c *gin.Context, aiService *ai.AIService) {
	// Get file from form
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File is required"})
		return
	}

	// Get metadata from form
	category := c.PostForm("category")
	location := c.PostForm("location")
	tagsStr := c.PostForm("tags")
	var tags []string
	if tagsStr != "" {
		tags = strings.Split(tagsStr, ",")
		for i := range tags {
			tags[i] = strings.TrimSpace(tags[i])
		}
	}

	// Open file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer src.Close()

	// Read file data
	fileData, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	// Determine file type
	fileType := file.Header.Get("Content-Type")
	if fileType == "" {
		// Try to determine from extension
		filename := strings.ToLower(file.Filename)
		if strings.HasSuffix(filename, ".json") {
			fileType = "application/json"
		} else if strings.HasSuffix(filename, ".csv") {
			fileType = "text/csv"
		} else if strings.HasSuffix(filename, ".txt") {
			fileType = "text/plain"
		}
	}

	// Create collector
	dataCollector := collector.NewDataCollector(aiService)

	// Collect data from file
	data, err := dataCollector.CollectFromFile(fileData, fileType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to parse file: %v", err)})
		return
	}

	if len(data) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No data extracted from file",
			"items":   0,
		})
		return
	}

	// Convert to RAG documents
	sourceName := file.Filename
	if category == "" {
		category = "file_import"
	}

	documents, err := dataCollector.ConvertToRAGDocuments(
		data,
		"file",
		sourceName,
		category,
		location,
		tags,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to convert to RAG: %v", err)})
		return
	}

	// Add documents to RAG database
	ragDB := aiService.GetRAGDatabase()
	addedCount := 0
	for _, doc := range documents {
		if err := ragDB.AddDocument(doc); err != nil {
			continue
		}
		addedCount++
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         fmt.Sprintf("Successfully imported and added %d documents", addedCount),
		"items_found":     len(data),
		"documents_added": addedCount,
		"documents":       documents,
	})
}

// handleGetRAGSummaries returns abstracted descriptions of all RAG documents
func handleGetRAGSummaries(c *gin.Context, aiService *ai.AIService) {
	ragDB := aiService.GetRAGDatabase()
	summaries := ragDB.GetAllDocumentSummaries()

	c.JSON(http.StatusOK, gin.H{
		"summaries": summaries,
		"total":     len(summaries),
	})
}

// Helper function to extract domain from URL
func extractDomainFromURL(url string) string {
	// Simple extraction - remove protocol and path
	url = strings.TrimPrefix(url, "http://")
	url = strings.TrimPrefix(url, "https://")
	
	// Get domain part
	parts := strings.Split(url, "/")
	if len(parts) > 0 {
		return parts[0]
	}
	return url
}

