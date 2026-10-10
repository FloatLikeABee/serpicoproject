package api

import (
	"database/sql"
	"net/http"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

func requestOrigin(c *gin.Context) string {
	scheme := "http"
	if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	return scheme + "://" + c.Request.Host
}

// 1x1 PNG. Used when no image model is configured.
var souvenirPNG = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
	0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54,
	0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
	0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0x02, 0xfe,
	0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
	0xae, 0x42, 0x60, 0x82,
}

func handleSouvenirCreate(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req struct {
		SourceKind string `json:"sourceKind"`
		SourceID   string `json:"sourceId"`
		HTML       string `json:"html"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.SourceKind != "travel" && req.SourceKind != "visit") || req.SourceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sourceKind, sourceId, and html are required"})
		return
	}
	id, html, err := storeSouvenir(db.SQLite, req.SourceKind, req.SourceID, req.HTML)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"id": id, "html": html})
}

func handleSouvenirRead(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	html, err := agentboard.ReadPage(db.SQLite, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": c.Param("id"), "html": html})
}

func storeSouvenir(db *sql.DB, kind, sourceID, html string) (string, string, error) {
	brief, err := agentboard.LoadBrief(db, kind, sourceID)
	if err != nil {
		return "", "", agentboard.ValidationError{Msg: "brief not found"}
	}
	clean, err := agentboard.SanitizeSouvenir(html, brief.ImageURLs)
	if err != nil {
		return "", "", err
	}
	id, err := agentboard.SavePage(db, kind, sourceID, clean, time.Now())
	if err != nil {
		return "", "", err
	}
	return id, clean, nil
}

func handleSouvenirImage(c *gin.Context) {
	switch c.Param("name") {
	case "travel", "cup":
		c.Data(200, "image/png", souvenirPNG)
	default:
		c.Status(404)
	}
}
