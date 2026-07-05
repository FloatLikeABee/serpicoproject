package api

import (
	"net/http"
	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

func handlePursuitExamEvaluate(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service not available"})
		return
	}

	var req struct {
		Stats ai.PursuitRoundStats `json:"stats"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	evaluation, err := service.EvaluatePursuitRound(req.Stats)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"evaluation": evaluation})
}
