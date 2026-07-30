package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Investigation timeline node under a case (ordered by event_time).
type investigationNode struct {
	ID         string `json:"id"`
	CaseID     string `json:"caseId"`
	AuthorName string `json:"authorName"`
	Place      string `json:"place"`
	Location   string `json:"location"`
	PersonName string `json:"name"`
	EventTime  string `json:"time"`
	Event      string `json:"event"`
	Analysis   string `json:"analysis"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

func scanNode(scanner interface {
	Scan(dest ...interface{}) error
}) (investigationNode, error) {
	var n investigationNode
	err := scanner.Scan(
		&n.ID, &n.CaseID, &n.AuthorName,
		&n.Place, &n.Location, &n.PersonName,
		&n.EventTime, &n.Event, &n.Analysis,
		&n.CreatedAt, &n.UpdatedAt,
	)
	return n, err
}

func caseExists(db *database.Database, caseID string) bool {
	var id string
	err := db.SQLite.QueryRow(`SELECT id FROM cases WHERE id = ?`, caseID).Scan(&id)
	return err == nil
}

func listNodesForCase(db *database.Database, caseID string) ([]investigationNode, error) {
	rows, err := db.SQLite.Query(`
		SELECT id, case_id, author_name,
			COALESCE(place,''), COALESCE(location,''), COALESCE(person_name,''),
			event_time, event, COALESCE(analysis,''),
			created_at, updated_at
		FROM investigation_nodes
		WHERE case_id = ?
		ORDER BY event_time ASC, created_at ASC`, caseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	nodes := []investigationNode{}
	for rows.Next() {
		n, err := scanNode(rows)
		if err == nil {
			nodes = append(nodes, n)
		}
	}
	return nodes, nil
}

// GET /cases/:id — case detail with timeline nodes ordered by time.
func handleGetCaseWithNodes(c *gin.Context, db *database.Database) {
	id := c.Param("id")

	var caseType, location, date, status, description string
	var solved int
	err := db.SQLite.QueryRow(
		`SELECT type, location, date, status, COALESCE(description,''), solved FROM cases WHERE id = ?`, id,
	).Scan(&caseType, &location, &date, &status, &description, &solved)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	nodes, err := listNodesForCase(db, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"case": gin.H{
			"id":          id,
			"type":        caseType,
			"location":    location,
			"date":        date,
			"status":      status,
			"description": description,
			"solved":      solved == 1,
			"nodeCount":   len(nodes),
		},
		"nodes": nodes,
	})
}

func handleListCaseNodes(c *gin.Context, db *database.Database) {
	caseID := c.Param("id")
	if !caseExists(db, caseID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
		return
	}
	nodes, err := listNodesForCase(db, caseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"caseId": caseID, "nodes": nodes})
}

func handleCreateCaseNode(c *gin.Context, db *database.Database) {
	caseID := c.Param("id")
	if !caseExists(db, caseID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nodes must belong to a case"})
		return
	}

	var req struct {
		AuthorName string `json:"authorName"`
		Place      string `json:"place"`
		Location   string `json:"location"`
		Name       string `json:"name"`
		Time       string `json:"time"`
		Event      string `json:"event"`
		Analysis   string `json:"analysis"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Event) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event is required"})
		return
	}
	if strings.TrimSpace(req.Time) == "" {
		req.Time = time.Now().UTC().Format("2006-01-02T15:04")
	}
	if req.AuthorName == "" {
		req.AuthorName = "Officer"
	}
	req.Event = cleanAssistText(req.Event)
	req.Analysis = cleanAssistText(req.Analysis)

	now := time.Now().UTC().Format(time.RFC3339)
	id := "node-" + uuid.New().String()[:8]
	_, err := db.SQLite.Exec(`
		INSERT INTO investigation_nodes
			(id, case_id, author_name, place, location, person_name, event_time, event, analysis, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, caseID, req.AuthorName, req.Place, req.Location, req.Name,
		req.Time, req.Event, req.Analysis, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"node": investigationNode{
			ID: id, CaseID: caseID, AuthorName: req.AuthorName,
			Place: req.Place, Location: req.Location, PersonName: req.Name,
			EventTime: req.Time, Event: req.Event, Analysis: req.Analysis,
			CreatedAt: now, UpdatedAt: now,
		},
	})
}

func handleUpdateNode(c *gin.Context, db *database.Database) {
	id := c.Param("id")
	var req struct {
		Place    string `json:"place"`
		Location string `json:"location"`
		Name     string `json:"name"`
		Time     string `json:"time"`
		Event    string `json:"event"`
		Analysis string `json:"analysis"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Event) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "event is required"})
		return
	}
	if strings.TrimSpace(req.Time) == "" {
		req.Time = time.Now().UTC().Format("2006-01-02T15:04")
	}
	req.Event = cleanAssistText(req.Event)
	req.Analysis = cleanAssistText(req.Analysis)

	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.SQLite.Exec(`
		UPDATE investigation_nodes
		SET place = ?, location = ?, person_name = ?, event_time = ?, event = ?, analysis = ?, updated_at = ?
		WHERE id = ?`,
		req.Place, req.Location, req.Name, req.Time, req.Event, req.Analysis, now, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}

	var node investigationNode
	err = db.SQLite.QueryRow(`
		SELECT id, case_id, author_name,
			COALESCE(place,''), COALESCE(location,''), COALESCE(person_name,''),
			event_time, event, COALESCE(analysis,''),
			created_at, updated_at
		FROM investigation_nodes WHERE id = ?`, id).
		Scan(&node.ID, &node.CaseID, &node.AuthorName,
			&node.Place, &node.Location, &node.PersonName,
			&node.EventTime, &node.Event, &node.Analysis,
			&node.CreatedAt, &node.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"node": node})
}

func handleDeleteNode(c *gin.Context, db *database.Database) {
	id := c.Param("id")
	res, err := db.SQLite.Exec(`DELETE FROM investigation_nodes WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Node not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// POST /cases/:id/nodes/assist — AI drafts event + analysis from partial node fields.
func handleAssistCaseNode(c *gin.Context, db *database.Database, aiService interface{}) {
	caseID := c.Param("id")
	if !caseExists(db, caseID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Case not found"})
		return
	}

	var req struct {
		Place    string `json:"place"`
		Location string `json:"location"`
		Name     string `json:"name"`
		Time     string `json:"time"`
		Event    string `json:"event"`
		Analysis string `json:"analysis"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var caseType, caseLoc, caseDate, caseDesc string
	_ = db.SQLite.QueryRow(
		`SELECT type, location, date, COALESCE(description,'') FROM cases WHERE id = ?`, caseID,
	).Scan(&caseType, &caseLoc, &caseDate, &caseDesc)

	aiSvc, ok := aiService.(interface {
		ProcessChat(userMessage string, context string, history []ai.ChatHistoryMessage) (string, error)
	})
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI service not available"})
		return
	}

	userMsg := fmt.Sprintf(
		`Return ONLY a JSON object with exactly two string fields: "event" and "analysis".
Do not nest objects or arrays. "analysis" must be one or two plain sentences of investigative notes (leads, gaps, next checks). No markdown fences.

Case: %s | %s | %s
Summary: %s

Node fields:
place=%s; location=%s; person=%s; time=%s
event draft=%s
analysis draft=%s`,
		caseType, caseLoc, caseDate, caseDesc,
		req.Place, req.Location, req.Name, req.Time, req.Event, req.Analysis,
	)

	content, err := aiSvc.ProcessChat(userMsg, "investigation-node-assist", nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	eventOut, analysisOut := parseAssistJSON(content, req.Event, req.Analysis)
	c.JSON(http.StatusOK, gin.H{
		"event":    eventOut,
		"analysis": analysisOut,
	})
}

func parseAssistJSON(raw, fallbackEvent, fallbackAnalysis string) (string, string) {
	raw = strings.TrimSpace(raw)
	raw = stripCodeFence(raw)

	// Prefer the first JSON object in the response if the model added prose.
	if obj := extractJSONObject(raw); obj != "" {
		raw = obj
	}

	var loose map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &loose); err != nil {
		// Not JSON — if it looks like leftover JSON noise, keep fallbacks.
		if strings.Contains(raw, `"event"`) || strings.Contains(raw, `"analysis"`) {
			return fallbackEvent, fallbackAnalysis
		}
		if fallbackEvent != "" {
			return fallbackEvent, cleanAssistText(raw)
		}
		return cleanAssistText(raw), fallbackAnalysis
	}

	eventOut := jsonFieldToPlainText(loose["event"])
	analysisOut := jsonFieldToPlainText(loose["analysis"])
	if eventOut == "" {
		eventOut = fallbackEvent
	}
	if analysisOut == "" {
		analysisOut = fallbackAnalysis
	}
	return eventOut, analysisOut
}

func stripCodeFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimPrefix(s, "```JSON")
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSpace(s)
		if i := strings.LastIndex(s, "```"); i >= 0 {
			s = strings.TrimSpace(s[:i])
		}
	}
	return s
}

func extractJSONObject(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start < 0 || end <= start {
		return ""
	}
	return s[start : end+1]
}

// jsonFieldToPlainText turns a JSON string/object/array into readable prose.
func jsonFieldToPlainText(raw json.RawMessage) string {
	if len(raw) == 0 {
		return ""
	}
	var asString string
	if err := json.Unmarshal(raw, &asString); err == nil {
		return cleanAssistText(asString)
	}
	var asObj map[string]interface{}
	if err := json.Unmarshal(raw, &asObj); err == nil {
		return flattenAssistMap(asObj)
	}
	var asArr []interface{}
	if err := json.Unmarshal(raw, &asArr); err == nil {
		parts := make([]string, 0, len(asArr))
		for _, item := range asArr {
			parts = append(parts, fmt.Sprint(item))
		}
		return cleanAssistText(strings.Join(parts, "; "))
	}
	return cleanAssistText(string(raw))
}

func flattenAssistMap(m map[string]interface{}) string {
	preferred := []string{"summary", "text", "notes", "analysis", "leads", "gaps", "next", "nextChecks", "next_checks"}
	parts := make([]string, 0, len(m))
	seen := map[string]bool{}
	for _, key := range preferred {
		if v, ok := m[key]; ok {
			seen[key] = true
			parts = append(parts, fmt.Sprintf("%s: %v", humanizeKey(key), v))
		}
	}
	for k, v := range m {
		if seen[k] {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s: %v", humanizeKey(k), v))
	}
	return cleanAssistText(strings.Join(parts, ". "))
}

func humanizeKey(key string) string {
	key = strings.ReplaceAll(key, "_", " ")
	if key == "" {
		return key
	}
	return strings.ToUpper(key[:1]) + key[1:]
}

func cleanAssistText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Trim(s, "`")
	s = strings.TrimSpace(s)
	// If a nested JSON string was stringified, try one more unwrap.
	if strings.HasPrefix(s, "{") && strings.HasSuffix(s, "}") {
		var m map[string]interface{}
		if err := json.Unmarshal([]byte(s), &m); err == nil {
			return flattenAssistMap(m)
		}
	}
	if strings.HasPrefix(s, "[") && strings.HasSuffix(s, "]") {
		var arr []interface{}
		if err := json.Unmarshal([]byte(s), &arr); err == nil {
			parts := make([]string, 0, len(arr))
			for _, item := range arr {
				parts = append(parts, fmt.Sprint(item))
			}
			return strings.Join(parts, "; ")
		}
	}
	return s
}
