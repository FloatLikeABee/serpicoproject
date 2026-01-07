package collector

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"serpico/backend/internal/ai"
)

// DataCollector handles data collection from various sources
type DataCollector struct {
	aiService *ai.AIService
	client    *http.Client
}

// NewDataCollector creates a new data collector
func NewDataCollector(aiService *ai.AIService) *DataCollector {
	return &DataCollector{
		aiService: aiService,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// CollectFromURL crawls a webpage and extracts text content
func (dc *DataCollector) CollectFromURL(url string) ([]string, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set a user agent to avoid blocking
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	resp, err := dc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP error: %d", resp.StatusCode)
	}

	// Parse HTML
	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to parse HTML: %w", err)
	}

	// Extract text from main content areas
	var chunks []string
	doc.Find("article, main, .content, .post, .entry, p").Each(func(i int, s *goquery.Selection) {
		text := strings.TrimSpace(s.Text())
		if len(text) > 100 { // Only include substantial chunks
			chunks = append(chunks, text)
		}
	})

	// If no main content found, extract all paragraphs
	if len(chunks) == 0 {
		doc.Find("p").Each(func(i int, s *goquery.Selection) {
			text := strings.TrimSpace(s.Text())
			if len(text) > 100 {
				chunks = append(chunks, text)
			}
		})
	}

	// If still no content, get body text
	if len(chunks) == 0 {
		bodyText := strings.TrimSpace(doc.Find("body").Text())
		if len(bodyText) > 0 {
			chunks = append(chunks, bodyText)
		}
	}

	return chunks, nil
}

// CollectFromAPI fetches data from an API endpoint
func (dc *DataCollector) CollectFromAPI(config APIConfig) ([]map[string]interface{}, error) {
	req, err := http.NewRequest(config.Method, config.URL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	for key, value := range config.Headers {
		req.Header.Set(key, value)
	}

	// Add query parameters
	if len(config.QueryParams) > 0 {
		q := req.URL.Query()
		for key, value := range config.QueryParams {
			q.Add(key, value)
		}
		req.URL.RawQuery = q.Encode()
	}

	resp, err := dc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API error: %d - %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse JSON response
	var data interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Extract data based on data path
	results := extractDataByPath(data, config.DataPath)
	return results, nil
}

// APIConfig represents API configuration
type APIConfig struct {
	URL         string            `json:"url"`
	Method      string            `json:"method"` // GET, POST, etc.
	Headers     map[string]string `json:"headers"`
	QueryParams map[string]string `json:"query_params"`
	DataPath    string            `json:"data_path"` // JSON path to extract data (e.g., "data.items", "results")
}

// extractDataByPath extracts data from JSON using a dot-notation path
func extractDataByPath(data interface{}, path string) []map[string]interface{} {
	if path == "" {
		// If no path specified, try to extract array of objects
		if arr, ok := data.([]interface{}); ok {
			results := make([]map[string]interface{}, 0)
			for _, item := range arr {
				if obj, ok := item.(map[string]interface{}); ok {
					results = append(results, obj)
				}
			}
			return results
		}
		if obj, ok := data.(map[string]interface{}); ok {
			return []map[string]interface{}{obj}
		}
		return []map[string]interface{}{}
	}

	// Navigate through path
	parts := strings.Split(path, ".")
	current := data

	for _, part := range parts {
		if m, ok := current.(map[string]interface{}); ok {
			current = m[part]
		} else if arr, ok := current.([]interface{}); ok {
			// If we hit an array, process all items
			results := make([]map[string]interface{}, 0)
			for _, item := range arr {
				if obj, ok := item.(map[string]interface{}); ok {
					results = append(results, obj)
				}
			}
			return results
		} else {
			return []map[string]interface{}{}
		}
	}

	// Convert final result to array of maps
	if arr, ok := current.([]interface{}); ok {
		results := make([]map[string]interface{}, 0)
		for _, item := range arr {
			if obj, ok := item.(map[string]interface{}); ok {
				results = append(results, obj)
			}
		}
		return results
	}

	if obj, ok := current.(map[string]interface{}); ok {
		return []map[string]interface{}{obj}
	}

	return []map[string]interface{}{}
}

// CollectFromFile parses uploaded files (JSON, CSV, TXT)
func (dc *DataCollector) CollectFromFile(fileData []byte, fileType string) ([]map[string]interface{}, error) {
	switch fileType {
	case "application/json", "json":
		return dc.parseJSON(fileData)
	case "text/csv", "csv":
		return dc.parseCSV(fileData)
	case "text/plain", "txt":
		return dc.parseTXT(fileData)
	default:
		return nil, fmt.Errorf("unsupported file type: %s", fileType)
	}
}

func (dc *DataCollector) parseJSON(data []byte) ([]map[string]interface{}, error) {
	var result interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// Handle different JSON structures
	if arr, ok := result.([]interface{}); ok {
		results := make([]map[string]interface{}, 0)
		for _, item := range arr {
			if obj, ok := item.(map[string]interface{}); ok {
				results = append(results, obj)
			}
		}
		return results, nil
	}

	if obj, ok := result.(map[string]interface{}); ok {
		return []map[string]interface{}{obj}, nil
	}

	return nil, fmt.Errorf("JSON structure not supported")
}

func (dc *DataCollector) parseCSV(data []byte) ([]map[string]interface{}, error) {
	reader := csv.NewReader(strings.NewReader(string(data)))
	reader.TrimLeadingSpace = true

	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to parse CSV: %w", err)
	}

	if len(records) == 0 {
		return []map[string]interface{}{}, nil
	}

	// First row as headers
	headers := records[0]
	results := make([]map[string]interface{}, 0)

	for i := 1; i < len(records); i++ {
		record := make(map[string]interface{})
		for j, header := range headers {
			if j < len(records[i]) {
				record[header] = records[i][j]
			}
		}
		results = append(results, record)
	}

	return results, nil
}

func (dc *DataCollector) parseTXT(data []byte) ([]map[string]interface{}, error) {
	text := string(data)
	// Split by paragraphs or lines
	lines := strings.Split(text, "\n\n")
	if len(lines) == 1 {
		lines = strings.Split(text, "\n")
	}

	results := make([]map[string]interface{}, 0)
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if len(line) > 0 {
			results = append(results, map[string]interface{}{
				"content": line,
			})
		}
	}

	return results, nil
}

// ConvertToRAGDocuments converts collected data to RAG documents
func (dc *DataCollector) ConvertToRAGDocuments(
	data interface{},
	sourceType string,
	sourceName string,
	category string,
	location string,
	tags []string,
) ([]ai.RAGDocument, error) {
	var documents []ai.RAGDocument

	switch v := data.(type) {
	case []string:
		// Web scraping results
		for i, chunk := range v {
			doc := ai.RAGDocument{
				ID:       fmt.Sprintf("rag-collected-%d-%d", time.Now().Unix(), i),
				Title:    fmt.Sprintf("%s - Chunk %d", sourceName, i+1),
				Content:  chunk,
				Category: category,
				Location: location,
				Tags:     append(tags, sourceType, "web"),
			}
			documents = append(documents, doc)
		}

	case []map[string]interface{}:
		// API or file results
		for i, item := range v {
			// Convert map to readable content
			content := dc.mapToContent(item)
			title := dc.extractTitle(item, sourceName, i)

			doc := ai.RAGDocument{
				ID:       fmt.Sprintf("rag-collected-%d-%d", time.Now().Unix(), i),
				Title:    title,
				Content:  content,
				Category: category,
				Location: location,
				Tags:     append(tags, sourceType),
			}
			documents = append(documents, doc)
		}
	}

	return documents, nil
}

func (dc *DataCollector) mapToContent(m map[string]interface{}) string {
	var parts []string
	for key, value := range m {
		var valStr string
		switch v := value.(type) {
		case string:
			valStr = v
		case float64:
			valStr = fmt.Sprintf("%.2f", v)
		case bool:
			valStr = fmt.Sprintf("%v", v)
		default:
			valStr = fmt.Sprintf("%v", v)
		}
		parts = append(parts, fmt.Sprintf("%s: %s", key, valStr))
	}
	return strings.Join(parts, "\n")
}

func (dc *DataCollector) extractTitle(m map[string]interface{}, sourceName string, index int) string {
	// Try common title fields
	if title, ok := m["title"].(string); ok && title != "" {
		return title
	}
	if name, ok := m["name"].(string); ok && name != "" {
		return name
	}
	if id, ok := m["id"].(string); ok && id != "" {
		return fmt.Sprintf("%s - %s", sourceName, id)
	}
	return fmt.Sprintf("%s - Item %d", sourceName, index+1)
}

