package api

import (
	"net/http"
	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

func handleChaseGameStart(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service.ChaseGame == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Chase game service not available"})
		return
	}

	var req struct {
		Difficulty string `json:"difficulty"`
	}
	_ = c.ShouldBindJSON(&req)

	session, err := service.ChaseGame.StartGame(req.Difficulty)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

func handleChaseGameRespond(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service.ChaseGame == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Chase game service not available"})
		return
	}

	sessionID := c.Param("id")
	var req struct {
		Answer string `json:"answer"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	session, err := service.ChaseGame.Respond(sessionID, req.Answer)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

func handleChaseGameGet(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service.ChaseGame == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Chase game service not available"})
		return
	}

	session, err := service.ChaseGame.GetSession(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}
