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
	robocopNoteMax    = 12
	robocopNoteWindow = time.Hour
)

var (
	robocopNoteMu   sync.Mutex
	robocopNoteHits = map[string][]time.Time{}
)

func resetRobocopNoteLimiter() {
	robocopNoteMu.Lock()
	defer robocopNoteMu.Unlock()
	robocopNoteHits = map[string][]time.Time{}
}

func robocopNoteAllowed(ip string, now time.Time) bool {
	cutoff := now.Add(-robocopNoteWindow)
	robocopNoteMu.Lock()
	defer robocopNoteMu.Unlock()
	kept := robocopNoteHits[ip][:0]
	for _, hit := range robocopNoteHits[ip] {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= robocopNoteMax {
		robocopNoteHits[ip] = kept
		return false
	}
	robocopNoteHits[ip] = append(kept, now)
	return true
}

type robocopNoteRequest struct {
	AgentName string   `json:"agentName"`
	AgentID   string   `json:"agentId"`
	Kind      string   `json:"kind"`
	PlaceName string   `json:"placeName"`
	Lat       *float64 `json:"lat"`
	Lng       *float64 `json:"lng"`
	Body      string   `json:"body"`
}

func robocopInput(req robocopNoteRequest) agentboard.RobocopInput {
	in := agentboard.RobocopInput{
		AgentName: req.AgentName,
		AgentID:   req.AgentID,
		Kind:      req.Kind,
		PlaceName: req.PlaceName,
		Body:      req.Body,
	}
	if req.Lat != nil {
		in.Lat = *req.Lat
	}
	if req.Lng != nil {
		in.Lng = *req.Lng
	}
	return in
}

func handleRobocopNotesList(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusOK, gin.H{"notes": []agentboard.RobocopNote{}})
		return
	}
	notes, err := agentboard.ListRobocop(db.SQLite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list notes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"notes": notes})
}

func handleRobocopNoteCreate(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req robocopNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Lat == nil || req.Lng == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, place, coordinates, and body are required"})
		return
	}
	in := robocopInput(req)
	if err := agentboard.ValidateRobocop(in); err != nil && req.AgentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !robocopNoteAllowed(c.ClientIP(), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many notes"})
		return
	}
	note, err := agentboard.InsertRobocop(db.SQLite, in, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, note)
}
