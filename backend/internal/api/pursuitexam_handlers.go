package api

import (
	"net/http"
	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

func pursuitUserFromRequest(c *gin.Context, bodyUserID string) string {
	if id := c.GetHeader("X-User-Id"); id != "" {
		return id
	}
	if bodyUserID != "" {
		return bodyUserID
	}
	return c.Query("userId")
}

func handlePursuitExamState(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service.PursuitExam == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pursuit exam service not available"})
		return
	}

	userID := pursuitUserFromRequest(c, "")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}

	session, err := service.PursuitExam.GetState(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

func handlePursuitExamStart(c *gin.Context, aiService interface{}) {
	handlePursuitExamState(c, aiService)
}

func handlePursuitExamArm(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service.PursuitExam == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pursuit exam service not available"})
		return
	}

	var req struct {
		UserID   string `json:"userId"`
		PoliceID string `json:"policeId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := pursuitUserFromRequest(c, req.UserID)
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	if req.PoliceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "policeId required"})
		return
	}

	session, err := service.PursuitExam.ArmPursuit(userID, req.PoliceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

func handlePursuitExamPursue(c *gin.Context, aiService interface{}) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service.PursuitExam == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Pursuit exam service not available"})
		return
	}

	var req struct {
		UserID   string `json:"userId"`
		PoliceID string `json:"policeId"`
		PerpID   string `json:"perpId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := pursuitUserFromRequest(c, req.UserID)
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user id required"})
		return
	}
	if req.PoliceID == "" || req.PerpID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "policeId and perpId required"})
		return
	}

	session, err := service.PursuitExam.StartPursuit(userID, req.PoliceID, req.PerpID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}
