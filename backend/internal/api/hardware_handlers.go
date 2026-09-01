package api

import (
	"errors"
	"net/http"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

type hardwareRegisterRequest struct {
	Serial string `json:"serial"`
}

func handleRegisterHardware(c *gin.Context, db *database.Database) {
	var req hardwareRegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}
	rec, created, err := database.RegisterHardware(db.SQLite, req.Serial)
	if err != nil {
		if errors.Is(err, database.ErrHardwareSerialEmpty) || errors.Is(err, database.ErrHardwareSerialInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, rec)
}

func handleListHardware(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}
	list, err := database.ListHardware(db.SQLite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"devices": list})
}

func handleGetHardware(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}
	rec, err := database.GetHardware(db.SQLite, c.Param("id"))
	if err != nil {
		if errors.Is(err, database.ErrHardwareNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rec)
}

func handleListHardwareMessages(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database unavailable"})
		return
	}
	rec, err := database.GetHardware(db.SQLite, c.Param("id"))
	if err != nil {
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
	c.JSON(http.StatusOK, gin.H{"records": list})
}
