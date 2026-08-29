package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"serpico/backend/internal/ai"
)

func handleDailyIntelStatus(c *gin.Context, aiService *ai.AIService) {
	if aiService == nil || aiService.DailyIntel == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "daily intel unavailable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": aiService.DailyIntel.Status()})
}

func handleDailyIntelNews(c *gin.Context, aiService *ai.AIService) {
	if aiService == nil || aiService.DailyIntel == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "daily intel unavailable"})
		return
	}
	limit := 20
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	nation := c.Query("nation")
	c.JSON(http.StatusOK, gin.H{"news": aiService.DailyIntel.ListNewsNation(nation, limit)})
}

func handleDailyIntelRun(c *gin.Context, aiService *ai.AIService) {
	if aiService == nil || aiService.DailyIntel == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "daily intel unavailable"})
		return
	}

	force := true
	var req struct {
		Force  *bool  `json:"force"`
		Nation string `json:"nation"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.Force != nil {
		force = *req.Force
	}

	go func() {
		if err := aiService.DailyIntel.Run(force); err != nil {
			_ = err
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Daily intel run started",
		"status":  aiService.DailyIntel.Status(),
	})
}
