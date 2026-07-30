package api

import (
	"database/sql"
	"net/http"
	"time"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type investigationNote struct {
	ID         string `json:"id"`
	CaseID     string `json:"caseId"`
	AuthorName string `json:"authorName"`
	Title      string `json:"title"`
	Body       string `json:"body"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

func scanNote(rows interface {
	Scan(dest ...interface{}) error
}) (investigationNote, error) {
	var n investigationNote
	err := rows.Scan(&n.ID, &n.CaseID, &n.AuthorName, &n.Title, &n.Body, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}

func caseExists(db *database.Database, caseID string) bool {
	var id string
	err := db.SQLite.QueryRow(`SELECT id FROM cases WHERE id = ?`, caseID).Scan(&id)
	return err == nil
}

// GET /cases/tree — cases as parent nodes with nested investigation notes.
func handleGetCasesTree(c *gin.Context, db *database.Database) {
	caseRows, err := db.SQLite.Query(`
		SELECT id, type, location, date, status, COALESCE(description,''), solved
		FROM cases ORDER BY date DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer caseRows.Close()

	type caseNode struct {
		ID          string              `json:"id"`
		Type        string              `json:"type"`
		Location    string              `json:"location"`
		Date        string              `json:"date"`
		Status      string              `json:"status"`
		Description string              `json:"description"`
		Solved      bool                `json:"solved"`
		Notes       []investigationNote `json:"notes"`
	}

	tree := []caseNode{}
	for caseRows.Next() {
		var node caseNode
		var solved int
		if err := caseRows.Scan(&node.ID, &node.Type, &node.Location, &node.Date, &node.Status, &node.Description, &solved); err != nil {
			continue
		}
		node.Solved = solved == 1
		node.Notes = []investigationNote{}

		noteRows, err := db.SQLite.Query(`
			SELECT id, case_id, author_name, title, body, created_at, updated_at
			FROM investigation_notes WHERE case_id = ? ORDER BY updated_at DESC`, node.ID)
		if err == nil {
			for noteRows.Next() {
				n, err := scanNote(noteRows)
				if err == nil {
					node.Notes = append(node.Notes, n)
				}
			}
			_ = noteRows.Close()
		}
		tree = append(tree, node)
	}

	c.JSON(http.StatusOK, gin.H{"cases": tree})
}

func handleListCaseNotes(c *gin.Context, db *database.Database) {
	caseID := c.Param("id")
	if !caseExists(db, caseID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Case not found — notes require a parent case"})
		return
	}

	rows, err := db.SQLite.Query(`
		SELECT id, case_id, author_name, title, body, created_at, updated_at
		FROM investigation_notes WHERE case_id = ? ORDER BY updated_at DESC`, caseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	notes := []investigationNote{}
	for rows.Next() {
		n, err := scanNote(rows)
		if err == nil {
			notes = append(notes, n)
		}
	}
	c.JSON(http.StatusOK, gin.H{"caseId": caseID, "notes": notes})
}

func handleCreateCaseNote(c *gin.Context, db *database.Database) {
	caseID := c.Param("id")
	if !caseExists(db, caseID) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Notes must belong to a case (parent node required)"})
		return
	}

	var req struct {
		AuthorName string `json:"authorName"`
		Title      string `json:"title"`
		Body       string `json:"body"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title == "" || req.Body == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and body are required"})
		return
	}
	if req.AuthorName == "" {
		req.AuthorName = "Officer"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	id := "note-" + uuid.New().String()[:8]
	_, err := db.SQLite.Exec(`
		INSERT INTO investigation_notes (id, case_id, author_name, title, body, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, caseID, req.AuthorName, req.Title, req.Body, now, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"note": investigationNote{
			ID: id, CaseID: caseID, AuthorName: req.AuthorName,
			Title: req.Title, Body: req.Body, CreatedAt: now, UpdatedAt: now,
		},
	})
}

func handleUpdateNote(c *gin.Context, db *database.Database) {
	id := c.Param("id")
	var req struct {
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Title == "" || req.Body == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and body are required"})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.SQLite.Exec(`
		UPDATE investigation_notes SET title = ?, body = ?, updated_at = ? WHERE id = ?`,
		req.Title, req.Body, now, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}

	var note investigationNote
	err = db.SQLite.QueryRow(`
		SELECT id, case_id, author_name, title, body, created_at, updated_at
		FROM investigation_notes WHERE id = ?`, id).
		Scan(&note.ID, &note.CaseID, &note.AuthorName, &note.Title, &note.Body, &note.CreatedAt, &note.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"note": note})
}

func handleDeleteNote(c *gin.Context, db *database.Database) {
	id := c.Param("id")
	res, err := db.SQLite.Exec(`DELETE FROM investigation_notes WHERE id = ?`, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Note not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
