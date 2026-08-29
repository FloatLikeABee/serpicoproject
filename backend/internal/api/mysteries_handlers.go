package api

import (
	"net/http"
	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

func mysteriesService(aiService interface{}) (*ai.MysteriesService, bool) {
	service, ok := aiService.(*ai.AIService)
	if !ok || service == nil || service.Mysteries == nil {
		return nil, false
	}
	return service.Mysteries, true
}

func handleMysteriesStatus(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	c.JSON(http.StatusOK, ms.Status())
}

func handleMysteriesListCases(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	category := c.Query("category")
	nation := helperNation(c)
	cases, err := ms.ListCasesNation(category, nation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if cases == nil {
		cases = []ai.MysteryCase{}
	}
	c.JSON(http.StatusOK, gin.H{
		"cases":  cases,
		"total":  len(cases),
		"status": ms.Status(),
	})
}

func handleMysteriesRefreshCases(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	nation := helperNation(c)
	go func() {
		_ = ms.RefreshCasesNation(nation, true)
	}()
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "message": "cases refresh started"})
}

func handleMysteriesListBriefings(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	nation := helperNation(c)
	list, err := ms.ListBriefingsNation(12, nation)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if list == nil {
		list = []ai.MysteryBriefing{}
	}
	latest, _ := ms.LatestBriefingNation(nation)
	c.JSON(http.StatusOK, gin.H{
		"briefings": list,
		"latest":    latest,
		"status":    ms.Status(),
	})
}

func handleMysteriesRefreshBriefing(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	nation := helperNation(c)
	go func() {
		_ = ms.RefreshBriefingNation(nation, true)
	}()
	c.JSON(http.StatusAccepted, gin.H{"ok": true, "message": "briefing refresh started"})
}

func handleMysteriesListInsights(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	list, err := ms.ListInsights(40)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if list == nil {
		list = []ai.MysteryInsight{}
	}
	c.JSON(http.StatusOK, gin.H{"insights": list, "total": len(list)})
}

func handleMysteriesSubmitInsight(c *gin.Context, aiService interface{}) {
	ms, ok := mysteriesService(aiService)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "mysteries service unavailable"})
		return
	}
	var req struct {
		AuthorName string `json:"authorName"`
		Title      string `json:"title"`
		Body       string `json:"body"`
		Category   string `json:"category"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	insight, err := ms.FactCheckAndSubmit(req.AuthorName, req.Title, req.Body, req.Category)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"insight": insight})
}
