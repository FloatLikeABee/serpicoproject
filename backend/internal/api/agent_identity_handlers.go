package api

import (
	"net/http"
	"sync"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

const agentClaimMax = 30

var (
	agentClaimMu   sync.Mutex
	agentClaimHits = map[string][]time.Time{}
)

func resetAgentClaimLimiter() {
	agentClaimMu.Lock()
	defer agentClaimMu.Unlock()
	agentClaimHits = map[string][]time.Time{}
}

func agentClaimAllowed(ip string, now time.Time) bool {
	cutoff := now.Add(-time.Hour)
	agentClaimMu.Lock()
	defer agentClaimMu.Unlock()
	kept := agentClaimHits[ip][:0]
	for _, hit := range agentClaimHits[ip] {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= agentClaimMax {
		agentClaimHits[ip] = kept
		return false
	}
	agentClaimHits[ip] = append(kept, now)
	return true
}

func handleAgentClaim(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	if !agentClaimAllowed(c.ClientIP(), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many names"})
		return
	}
	ident, err := agentboard.ClaimIdentity(db.SQLite, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not claim a name"})
		return
	}
	c.JSON(http.StatusCreated, ident)
}

func handleAgentLookup(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	ident, err := agentboard.LookupIdentity(db.SQLite, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, ident)
}
