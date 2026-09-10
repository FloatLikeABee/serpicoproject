package api

import (
	"encoding/base64"
	"net/http"
	"strings"
	"sync"
	"time"

	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

const fridgeRaidMaxImageBytes = 1536 * 1024 // 1.5 MiB

var (
	fridgeRaidMaxAttempts = 8
	fridgeRaidWindow      = 10 * time.Minute
	fridgeRaidMu          sync.Mutex
	fridgeRaidHits        = map[string][]time.Time{}
)

func resetFridgeRaidLimiter() {
	fridgeRaidMu.Lock()
	defer fridgeRaidMu.Unlock()
	fridgeRaidHits = map[string][]time.Time{}
}

func fridgeRaidAllowed(ip string) bool {
	if ip == "" {
		ip = "unknown"
	}
	now := time.Now()
	cutoff := now.Add(-fridgeRaidWindow)
	fridgeRaidMu.Lock()
	defer fridgeRaidMu.Unlock()
	hits := fridgeRaidHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= fridgeRaidMaxAttempts {
		fridgeRaidHits[ip] = kept
		return false
	}
	fridgeRaidHits[ip] = append(kept, now)
	return true
}

type fridgeRaidAdviser interface {
	AdviseFridgeRaid(in ai.FridgeRaidAdviseInput) (*ai.FridgeRaidCards, error)
}

func handleFridgeRaidChat(c *gin.Context, aiService interface{}) {
	if !fridgeRaidAllowed(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again in a few minutes."})
		return
	}
	var req struct {
		Locale      string   `json:"locale"`
		Text        string   `json:"text"`
		Plan        string   `json:"plan"`
		ImageBase64 string   `json:"imageBase64"`
		ImageMIME   string   `json:"imageMime"`
		Lat         *float64 `json:"lat"`
		Lon         *float64 `json:"lon"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var image []byte
	if strings.TrimSpace(req.ImageBase64) != "" {
		decoded, err := base64.StdEncoding.DecodeString(req.ImageBase64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid image encoding"})
			return
		}
		if len(decoded) > fridgeRaidMaxImageBytes {
			c.JSON(http.StatusBadRequest, gin.H{"error": "image too large"})
			return
		}
		mime := strings.TrimSpace(req.ImageMIME)
		if mime == "" {
			mime = "image/jpeg"
		}
		if !strings.HasPrefix(mime, "image/") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "image required"})
			return
		}
		image = decoded
		req.ImageMIME = mime
	}

	adviser, ok := aiService.(fridgeRaidAdviser)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "kitchen advisor is not available"})
		return
	}
	cards, err := adviser.AdviseFridgeRaid(ai.FridgeRaidAdviseInput{
		Locale:    req.Locale,
		Leftovers: req.Text,
		Plan:      req.Plan,
		Image:     image,
		ImageMIME: req.ImageMIME,
		Lat:       req.Lat,
		Lon:       req.Lon,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cards)
}

type fridgeRaidDetailAdviser interface {
	AdviseFridgeRaidDetail(in ai.FridgeRaidDetailInput) (*ai.FridgeRaidDishDetail, error)
}

func handleFridgeRaidDetail(c *gin.Context, aiService interface{}) {
	if !fridgeRaidAllowed(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again in a few minutes."})
		return
	}
	var req struct {
		Locale     string                  `json:"locale"`
		Suggestion ai.FridgeRaidSuggestion `json:"suggestion"`
		Season     string                  `json:"season"`
		SolarTerm  string                  `json:"solarTerm"`
		Weather    *ai.FridgeRaidWeather   `json:"weather"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.Suggestion.Title) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "dish title required"})
		return
	}
	adviser, ok := aiService.(fridgeRaidDetailAdviser)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "kitchen advisor is not available"})
		return
	}
	var weather *ai.WeatherSnapshot
	if req.Weather != nil {
		weather = &ai.WeatherSnapshot{Label: req.Weather.Label, TempC: req.Weather.TempC}
	}
	detail, err := adviser.AdviseFridgeRaidDetail(ai.FridgeRaidDetailInput{
		Locale:     req.Locale,
		Suggestion: req.Suggestion,
		Season:     ai.SeasonInfo{Name: req.Season, SolarTerm: req.SolarTerm},
		Weather:    weather,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, detail)
}
