package ai

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// RAGDocument represents a document in the RAG database
type RAGDocument struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Content     string   `json:"content"`
	Category    string   `json:"category"`
	Location    string   `json:"location,omitempty"`
	Tags        []string `json:"tags"`
	Embedding   []float64 `json:"-"` // Not stored, computed on demand
}

// RAGDatabase manages the RAG document store
type RAGDatabase struct {
	documents []RAGDocument
	dataPath  string
}

func NewRAGDatabase(dataPath string) (*RAGDatabase, error) {
	db := &RAGDatabase{
		documents: []RAGDocument{},
		dataPath:  dataPath,
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll(dataPath, 0755); err != nil {
		return nil, err
	}

	// Load existing documents
	if err := db.loadDocuments(); err != nil {
		return nil, err
	}

	return db, nil
}

func (r *RAGDatabase) loadDocuments() error {
	filePath := filepath.Join(r.dataPath, "documents.json")
	
	// If file doesn't exist, initialize with seed data
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return r.seedDocuments()
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	if len(data) == 0 {
		return r.seedDocuments()
	}

	return json.Unmarshal(data, &r.documents)
}

func (r *RAGDatabase) saveDocuments() error {
	filePath := filepath.Join(r.dataPath, "documents.json")
	data, err := json.MarshalIndent(r.documents, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, data, 0644)
}

func (r *RAGDatabase) seedDocuments() error {
	r.documents = []RAGDocument{
		// Olathe Criminal Data
		{
			ID:       "rag-001",
			Title:    "Olathe Crime Statistics 2023",
			Content:  "Olathe PD reported 1,234 total crimes in 2023. High-crime areas include Downtown Olathe (S Kansas Ave), North Olathe (N Ridgeview Rd), and East Olathe (E 151st St). Most common crimes: theft (34%), assault (28%), robbery (18%), burglary (12%), other (8%).",
			Category: "crime_stats",
			Location: "Olathe, KS",
			Tags:     []string{"statistics", "crime", "olathe", "2023"},
		},
		{
			ID:       "rag-002",
			Title:    "Active Criminal Areas in Olathe",
			Content:  "High-activity areas: 1) Downtown Olathe (S Kansas Ave, E Santa Fe St) - frequent robberies and assaults. 2) North Olathe (N Ridgeview Rd, N Black Bob Rd) - drug activity and burglaries. 3) East Olathe (E 151st St, E Dennis Ave) - vehicle thefts and vandalism. 4) South Olathe (S Mur-Len Rd) - domestic disturbances.",
			Category: "locations",
			Location: "Olathe, KS",
			Tags:     []string{"locations", "hotspots", "crime", "olathe"},
		},
		{
			ID:       "rag-003",
			Title:    "Known Perpetrators in Olathe",
			Content:  "Active subjects: Subject Alpha - last seen Downtown Olathe, involved in 3 armed robberies. Subject Bravo - wanted in North Olathe, 2 assault cases. Subject Delta - active in South Olathe, 1 burglary case. Subject Foxtrot - Central Olathe, multiple thefts.",
			Category: "perps",
			Location: "Olathe, KS",
			Tags:     []string{"perpetrators", "suspects", "wanted", "olathe"},
		},
		// Hot Pursuit Strategies
		{
			ID:       "rag-004",
			Title:    "Hot Pursuit Strategy - Urban Areas",
			Content:  "Urban pursuit protocol: 1) Maintain safe distance (3-5 car lengths). 2) Use parallel routes when possible. 3) Coordinate with air support if available. 4) Avoid high-speed chases in residential areas. 5) Set up roadblocks at major intersections. 6) Use spike strips on highways. Success rate: 78% in Olathe urban areas.",
			Category: "strategy",
			Location: "Olathe, KS",
			Tags:     []string{"pursuit", "strategy", "urban", "tactics"},
		},
		{
			ID:       "rag-005",
			Title:    "Hot Pursuit Strategy - Highway",
			Content:  "Highway pursuit protocol: 1) Request backup immediately. 2) Coordinate with state patrol. 3) Use PIT maneuver only on highways with clear lanes. 4) Deploy spike strips at exit ramps. 5) Maintain communication with dispatch. 6) Consider helicopter support for long pursuits. Success rate: 85% on I-35 and K-10 near Olathe.",
			Category: "strategy",
			Location: "Olathe, KS",
			Tags:     []string{"pursuit", "strategy", "highway", "tactics"},
		},
		{
			ID:       "rag-006",
			Title:    "Hot Pursuit Strategy - Residential",
			Content:  "Residential pursuit protocol: 1) Reduce speed significantly. 2) Avoid pursuit if risk to public is high. 3) Use containment strategy - block exits. 4) Coordinate with K-9 units. 5) Use less-lethal options when possible. 6) Document all actions. Success rate: 72% in Olathe residential areas.",
			Category: "strategy",
			Location: "Olathe, KS",
			Tags:     []string{"pursuit", "strategy", "residential", "tactics"},
		},
		// History Data
		{
			ID:       "rag-007",
			Title:    "Olathe PD Pursuit History 2023",
			Content:  "2023 pursuit statistics: Total pursuits: 47. Successful arrests: 38 (81%). Average duration: 8.5 minutes. Most common routes: I-35 (18 pursuits), K-10 (12 pursuits), S Kansas Ave (8 pursuits), N Ridgeview Rd (6 pursuits). Most active times: 10 PM - 2 AM (62% of pursuits).",
			Category: "history",
			Location: "Olathe, KS",
			Tags:     []string{"history", "pursuits", "statistics", "2023"},
		},
		{
			ID:       "rag-008",
			Title:    "Successful Arrest Patterns in Olathe",
			Content:  "Arrest success patterns: 1) Pursuits ending on I-35: 89% success rate. 2) Pursuits ending in residential areas: 65% success rate. 3) Pursuits with air support: 94% success rate. 4) Night pursuits (10 PM - 6 AM): 78% success rate. 5) Day pursuits (6 AM - 10 PM): 84% success rate. Best approach: Containment + K-9 units.",
			Category: "history",
			Location: "Olathe, KS",
			Tags:     []string{"history", "arrests", "patterns", "success"},
		},
		{
			ID:       "rag-009",
			Title:    "Olathe PD Case Resolution Rates",
			Content:  "2023 case resolution: Armed Assault: 78% solved. Robbery: 82% solved. Murder: 45% solved (2 unsolved cases). Sexual Assault: 88% solved. Theft: 65% solved. Average time to resolution: 12 days. Best performing unit: Robbery division (82% closure rate).",
			Category: "history",
			Location: "Olathe, KS",
			Tags:     []string{"history", "cases", "resolution", "statistics"},
		},
		{
			ID:       "rag-010",
			Title:    "Olathe Criminal Activity by Location",
			Content:  "Location-based crime data: S Kansas Ave (Downtown): 234 incidents, mostly robberies and assaults. E Santa Fe St: 189 incidents, thefts and burglaries. N Ridgeview Rd: 156 incidents, drug activity and assaults. E 151st St: 142 incidents, vehicle crimes. W Park St: 98 incidents, domestic disturbances. S Mur-Len Rd: 87 incidents, property crimes.",
			Category: "locations",
			Location: "Olathe, KS",
			Tags:     []string{"locations", "crime", "statistics", "olathe"},
		},
	}

	return r.saveDocuments()
}

// Search finds relevant documents based on query
func (r *RAGDatabase) Search(query string, limit int) []RAGDocument {
	if limit <= 0 {
		limit = 5
	}

	queryLower := strings.ToLower(query)
	results := []RAGDocument{}
	scores := make(map[int]float64)

	for i, doc := range r.documents {
		score := 0.0

		// Simple keyword matching (in production, use proper vector embeddings)
		contentLower := strings.ToLower(doc.Content)
		titleLower := strings.ToLower(doc.Title)

		// Check title matches
		if strings.Contains(titleLower, queryLower) {
			score += 3.0
		}

		// Check content matches
		queryWords := strings.Fields(queryLower)
		for _, word := range queryWords {
			if strings.Contains(contentLower, word) {
				score += 1.0
			}
		}

		// Check tag matches
		for _, tag := range doc.Tags {
			if strings.Contains(queryLower, strings.ToLower(tag)) {
				score += 2.0
			}
		}

		// Check location matches
		if strings.Contains(queryLower, "olathe") && strings.Contains(strings.ToLower(doc.Location), "olathe") {
			score += 1.5
		}

		if score > 0 {
			scores[i] = score
		}
	}

	// Sort by score (simple implementation)
	type scoredDoc struct {
		doc   RAGDocument
		score float64
	}
	scoredDocs := []scoredDoc{}
	for i, score := range scores {
		scoredDocs = append(scoredDocs, scoredDoc{r.documents[i], score})
	}

	// Simple sort (bubble sort for small datasets)
	for i := 0; i < len(scoredDocs)-1; i++ {
		for j := i + 1; j < len(scoredDocs); j++ {
			if scoredDocs[i].score < scoredDocs[j].score {
				scoredDocs[i], scoredDocs[j] = scoredDocs[j], scoredDocs[i]
			}
		}
	}

	// Return top results
	for i := 0; i < limit && i < len(scoredDocs); i++ {
		results = append(results, scoredDocs[i].doc)
	}

	return results
}

// AddDocument adds a new document to the RAG database
func (r *RAGDatabase) AddDocument(doc RAGDocument) error {
	r.documents = append(r.documents, doc)
	return r.saveDocuments()
}

// GetAllDocuments returns all documents
func (r *RAGDatabase) GetAllDocuments() []RAGDocument {
	return r.documents
}

// GetDocumentByID returns a document by ID
func (r *RAGDatabase) GetDocumentByID(id string) *RAGDocument {
	for i := range r.documents {
		if r.documents[i].ID == id {
			return &r.documents[i]
		}
	}
	return nil
}

// UpdateDocument updates an existing document
func (r *RAGDatabase) UpdateDocument(id string, doc RAGDocument) error {
	for i := range r.documents {
		if r.documents[i].ID == id {
			r.documents[i] = doc
			r.documents[i].ID = id // Ensure ID doesn't change
			return r.saveDocuments()
		}
	}
	return nil // Document not found
}

// DeleteDocument deletes a document by ID
func (r *RAGDatabase) DeleteDocument(id string) error {
	for i, doc := range r.documents {
		if doc.ID == id {
			r.documents = append(r.documents[:i], r.documents[i+1:]...)
			return r.saveDocuments()
		}
	}
	return nil // Document not found
}

