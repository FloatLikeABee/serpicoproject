package api

import (
	"encoding/json"
	"net/http"
	"time"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

func handleGetMapTags(c *gin.Context, db *database.Database) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	var tagsJSON string
	err := db.SQLite.QueryRow(
		`SELECT tags_json FROM user_map_tags WHERE user_id = ?`, userID,
	).Scan(&tagsJSON)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"tags": []interface{}{}})
		return
	}

	var tags []json.RawMessage
	if err := json.Unmarshal([]byte(tagsJSON), &tags); err != nil {
		c.JSON(http.StatusOK, gin.H{"tags": []interface{}{}})
		return
	}
	c.JSON(http.StatusOK, gin.H{"tags": tags})
}

func handlePutMapTags(c *gin.Context, db *database.Database) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	var req struct {
		Tags json.RawMessage `json:"tags"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tagsJSON := "[]"
	if len(req.Tags) > 0 {
		tagsJSON = string(req.Tags)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.SQLite.Exec(`
		INSERT INTO user_map_tags (user_id, tags_json, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET tags_json = excluded.tags_json, updated_at = excluded.updated_at`,
		userID, tagsJSON, now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "updatedAt": now})
}

func handleGetChatSync(c *gin.Context, db *database.Database) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	var dataJSON string
	err := db.SQLite.QueryRow(
		`SELECT data_json FROM user_chat_data WHERE user_id = ?`, userID,
	).Scan(&dataJSON)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"entries":  map[string]interface{}{},
			"sessions": []interface{}{},
		})
		return
	}

	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(dataJSON), &payload); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"entries":  map[string]interface{}{},
			"sessions": []interface{}{},
		})
		return
	}
	c.JSON(http.StatusOK, payload)
}

func handlePutChatSync(c *gin.Context, db *database.Database) {
	userID, ok := requireUserID(c)
	if !ok {
		return
	}

	var req map[string]interface{}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dataJSON, err := json.Marshal(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	_, err = db.SQLite.Exec(`
		INSERT INTO user_chat_data (user_id, data_json, updated_at)
		VALUES (?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at`,
		userID, string(dataJSON), now)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true, "updatedAt": now})
}
