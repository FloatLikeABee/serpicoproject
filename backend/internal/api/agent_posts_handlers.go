package api

import (
	"net/http"
	"sync"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

const (
	agentPostMax    = 12
	agentPostWindow = time.Hour
)

var (
	agentPostMu   sync.Mutex
	agentPostHits = map[string][]time.Time{}
)

func resetAgentPostLimiter() {
	agentPostMu.Lock()
	defer agentPostMu.Unlock()
	agentPostHits = map[string][]time.Time{}
}

func agentPostAllowed(ip string, now time.Time) bool {
	cutoff := now.Add(-agentPostWindow)
	agentPostMu.Lock()
	defer agentPostMu.Unlock()
	kept := agentPostHits[ip][:0]
	for _, hit := range agentPostHits[ip] {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= agentPostMax {
		agentPostHits[ip] = kept
		return false
	}
	agentPostHits[ip] = append(kept, now)
	return true
}

type agentPostRequest struct {
	AgentName string   `json:"agentName"`
	PlaceName string   `json:"placeName"`
	Lat       *float64 `json:"lat"`
	Lng       *float64 `json:"lng"`
	Body      string   `json:"body"`
}

func handleAgentPostsList(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusOK, gin.H{"posts": []agentboard.Post{}})
		return
	}
	posts, err := agentboard.ListPosts(db.SQLite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list posts"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": posts})
}

func handleAgentPostCreate(c *gin.Context, db *database.Database, kind string) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req agentPostRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Lat == nil || req.Lng == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, place, coordinates, and body are required"})
		return
	}
	in := agentboard.PostInput{
		AgentName: req.AgentName,
		PlaceName: req.PlaceName,
		Lat:       *req.Lat,
		Lng:       *req.Lng,
		Body:      req.Body,
	}
	if err := agentboard.ValidatePost(kind, in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !agentPostAllowed(c.ClientIP(), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many posts"})
		return
	}
	post, err := agentboard.InsertPost(db.SQLite, kind, in, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, post)
}
