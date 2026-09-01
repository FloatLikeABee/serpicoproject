package api

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

type hardDataIngestRequest struct {
	Payload string `json:"payload"`
	Topic   string `json:"topic"`
}

func handleIngestHardData(c *gin.Context, db *database.Database) {
	var req hardDataIngestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	rec, err := database.InsertHardData(db.SQLite, req.Topic, req.Payload, database.HardDataSourceHTTP)
	if err != nil {
		status := http.StatusBadRequest
		if !errors.Is(err, database.ErrHardDataEmpty) &&
			!errors.Is(err, database.ErrHardDataTooLarge) &&
			!errors.Is(err, database.ErrHardDataSource) {
			status = http.StatusInternalServerError
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rec)
}

func handleListHardDataBySerial(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}
	rec, err := database.GetHardwareBySerial(db.SQLite, c.Param("serial"))
	if err != nil {
		if errors.Is(err, database.ErrHardwareSerialEmpty) || errors.Is(err, database.ErrHardwareSerialInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, database.ErrHardwareNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	list, err := database.ListHardDataByTopic(db.SQLite, rec.Topic, database.HardDataDefaultLimit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"serial": rec.Serial, "topic": rec.Topic, "records": list})
}

func handleListHardData(c *gin.Context, db *database.Database) {
	limit := database.HardDataDefaultLimit
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err == nil && n > 0 {
			limit = n
		}
	}
	list, err := database.ListHardData(db.SQLite, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"records": list})
}
