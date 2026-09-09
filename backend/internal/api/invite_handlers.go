package api

import (
	"database/sql"
	"net/http"
	"sync"
	"time"

	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

var (
	redeemMaxAttempts = 10
	redeemWindow      = 15 * time.Minute
	redeemMu          sync.Mutex
	redeemHits        = map[string][]time.Time{}
)

func resetRedeemLimiter() {
	redeemMu.Lock()
	defer redeemMu.Unlock()
	redeemHits = map[string][]time.Time{}
}

func redeemAllowed(ip string) bool {
	if ip == "" {
		ip = "unknown"
	}
	now := time.Now()
	cutoff := now.Add(-redeemWindow)
	redeemMu.Lock()
	defer redeemMu.Unlock()
	hits := redeemHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= redeemMaxAttempts {
		redeemHits[ip] = kept
		return false
	}
	redeemHits[ip] = append(kept, now)
	return true
}

func handleAdminCreateInvite(c *gin.Context, db *database.Database) {
	var req struct {
		Note string `json:"note"`
	}
	_ = c.ShouldBindJSON(&req)
	rec, err := database.CreateInvite(db.SQLite, req.Note)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, rec)
}

func handleAdminListInvites(c *gin.Context, db *database.Database) {
	list, err := database.ListInvites(db.SQLite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"invites": list})
}

func handleRedeemInvite(c *gin.Context, db *database.Database) {
	if !redeemAllowed(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many attempts"})
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rec, err := database.GetInviteByCode(db.SQLite, req.Code)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invalid invitation code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"username": rec.Username, "password": rec.Password})
}
