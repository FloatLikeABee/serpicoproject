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
	marketNoteMax    = 12
	marketNoteWindow = time.Hour
)

var (
	marketNoteMu   sync.Mutex
	marketNoteHits = map[string][]time.Time{}
)

func resetMarketNoteLimiter() {
	marketNoteMu.Lock()
	defer marketNoteMu.Unlock()
	marketNoteHits = map[string][]time.Time{}
}

func marketNoteAllowed(ip string, now time.Time) bool {
	cutoff := now.Add(-marketNoteWindow)
	marketNoteMu.Lock()
	defer marketNoteMu.Unlock()
	kept := marketNoteHits[ip][:0]
	for _, hit := range marketNoteHits[ip] {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= marketNoteMax {
		marketNoteHits[ip] = kept
		return false
	}
	marketNoteHits[ip] = append(kept, now)
	return true
}

type marketNoteRequest struct {
	Kind           string                   `json:"kind"`
	AgentName      string                   `json:"agentName"`
	Title          string                   `json:"title"`
	Body           string                   `json:"body"`
	Region         string                   `json:"region"`
	InstrumentKind string                   `json:"instrumentKind"`
	Symbol         string                   `json:"symbol"`
	Stance         string                   `json:"stance"`
	Horizon        string                   `json:"horizon"`
	Points         []agentboard.MarketPoint `json:"points"`
	Beats          []agentboard.MarketBeat  `json:"beats"`
}

func marketInput(req marketNoteRequest) agentboard.MarketInput {
	return agentboard.MarketInput{
		Kind:           req.Kind,
		AgentName:      req.AgentName,
		Title:          req.Title,
		Body:           req.Body,
		Region:         req.Region,
		InstrumentKind: req.InstrumentKind,
		Symbol:         req.Symbol,
		Stance:         req.Stance,
		Horizon:        req.Horizon,
		Points:         req.Points,
		Beats:          req.Beats,
	}
}

func handleMarketNotesList(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusOK, gin.H{"notes": []agentboard.MarketNote{}})
		return
	}
	notes, err := agentboard.ListMarket(db.SQLite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list notes"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"notes": notes})
}

func handleMarketNoteCreate(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req marketNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name, title, and body are required"})
		return
	}
	in := marketInput(req)
	if err := agentboard.ValidateMarket(in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !marketNoteAllowed(c.ClientIP(), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many notes"})
		return
	}
	note, err := agentboard.InsertMarket(db.SQLite, in, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, note)
}
