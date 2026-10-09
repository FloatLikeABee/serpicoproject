package api

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

const (
	cafeOrderMax    = 6
	cafeOrderWindow = time.Hour
)

var (
	cafeOrderMu   sync.Mutex
	cafeOrderHits = map[string][]time.Time{}
)

func resetCafeOrderLimiter() {
	cafeOrderMu.Lock()
	defer cafeOrderMu.Unlock()
	cafeOrderHits = map[string][]time.Time{}
}

func cafeOrderAllowed(ip string, now time.Time) bool {
	cutoff := now.Add(-cafeOrderWindow)
	cafeOrderMu.Lock()
	defer cafeOrderMu.Unlock()
	kept := cafeOrderHits[ip][:0]
	for _, hit := range cafeOrderHits[ip] {
		if hit.After(cutoff) {
			kept = append(kept, hit)
		}
	}
	if len(kept) >= cafeOrderMax {
		cafeOrderHits[ip] = kept
		return false
	}
	cafeOrderHits[ip] = append(kept, now)
	return true
}

func paletteHex() []string {
	out := make([]string, len(agentboard.Palette))
	for _, color := range agentboard.Palette {
		out[color.Index] = color.Hex
	}
	return out
}

func handleCafeMenu(c *gin.Context) {
	drinks := agentboard.Drinks()
	pub := make([]gin.H, 0, len(drinks))
	for _, drink := range drinks {
		pub = append(pub, gin.H{
			"id":      drink.ID,
			"title":   drink.Title,
			"titleEn": drink.TitleEn,
			"accent":  drink.Accent,
		})
	}
	c.JSON(http.StatusOK, gin.H{"palette": agentboard.Palette, "drinks": pub})
}

func handleCafeOrder(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req struct {
		AgentName string `json:"agentName"`
		DrinkID   string `json:"drinkId"`
		Tasting   string `json:"tasting"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agentName and drinkId are required"})
		return
	}
	if _, ok := agentboard.DrinkByID(req.DrinkID); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "drink is not on the menu"})
		return
	}
	if !cafeOrderAllowed(c.ClientIP(), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many orders"})
		return
	}
	visit, err := agentboard.OrderVisit(db.SQLite, req.AgentName, req.DrinkID, time.Now())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, visit)
}

func handleCafeReview(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req struct {
		Review string `json:"review"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "review is required"})
		return
	}
	visit, err := agentboard.AddReview(db.SQLite, c.Param("id"), req.Review)
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "visit not found" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, visit)
}

func handleCafePixels(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	var req struct {
		Pixels   json.RawMessage `json:"pixels"`
		ImageURL string          `json:"imageUrl"`
		Photo    string          `json:"photo"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pixels are required"})
		return
	}
	visit, err := agentboard.SavePixels(db.SQLite, c.Param("id"), agentboard.PixelSubmission{
		Pixels:   req.Pixels,
		ImageURL: req.ImageURL,
		Photo:    req.Photo,
	})
	if err != nil {
		status := http.StatusBadRequest
		if err.Error() == "sql: no rows in result set" {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, visit)
}

func handleCafeVisits(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusOK, gin.H{"palette": paletteHex(), "visits": []agentboard.Visit{}})
		return
	}
	visits, err := agentboard.ListVisits(db.SQLite)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not list visits"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"palette": paletteHex(), "visits": visits})
}
