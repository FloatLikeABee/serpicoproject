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
		`Return ONLY valid JSON with keys "event" and "analysis" (no markdown).

Case: %s | %s | %s
Summary: %s

Node fields:
place=%s; location=%s; person=%s; time=%s
event draft=%s
analysis draft=%s

Write a clear factual event description and a short investigative analysis (leads, gaps, next checks).`,
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
	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(strings.TrimSpace(raw), "```")
	raw = strings.TrimSpace(raw)

	var parsed struct {
		Event    string `json:"event"`
		Analysis string `json:"analysis"`
	}
	if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
		if fallbackEvent != "" {
			return fallbackEvent, raw
		}
		return raw, fallbackAnalysis
	}
	if parsed.Event == "" {
		parsed.Event = fallbackEvent
	}
	if parsed.Analysis == "" {
		parsed.Analysis = fallbackAnalysis
	}
	return parsed.Event, parsed.Analysis
}
