package api

import (
	"net/http"
	"sync"
	"time"

	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

var (
	lalemMaxAttempts = 8
	lalemWindow      = 10 * time.Minute
	lalemMu          sync.Mutex
	lalemHits        = map[string][]time.Time{}

	lalemCacheTTL  = time.Hour
	lalemCacheMu   sync.Mutex
	lalemDigestMem = map[string]lalemCacheEntry{}
)

type lalemCacheEntry struct {
	digest *ai.LalemDigest
	at     time.Time
}

func resetLalemLimiter() {
	lalemMu.Lock()
	defer lalemMu.Unlock()
	lalemHits = map[string][]time.Time{}
}

func resetLalemDigestCache() {
	lalemCacheMu.Lock()
	defer lalemCacheMu.Unlock()
	lalemDigestMem = map[string]lalemCacheEntry{}
}

func lalemAllowed(ip string) bool {
	if ip == "" {
		ip = "unknown"
	}
	now := time.Now()
	cutoff := now.Add(-lalemWindow)
	lalemMu.Lock()
	defer lalemMu.Unlock()
	hits := lalemHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= lalemMaxAttempts {
		lalemHits[ip] = kept
		return false
	}
	lalemHits[ip] = append(kept, now)
	return true
}

func handleLalemToilets(c *gin.Context) {
	f := ai.LalemToiletFilter{
		Shape: c.Query("shape"),
		Size:  c.Query("size"),
		Class: c.Query("class"),
		Era:   c.Query("era"),
	}
	c.JSON(http.StatusOK, gin.H{"toilets": ai.FilterLalemToilets(f)})
}

type lalemAdviser interface {
	AdviseLalemDigest(in ai.LalemDigestInput) (*ai.LalemDigest, error)
}

func handleLalemDigest(c *gin.Context, aiService interface{}) {
	if !lalemAllowed(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again in a few minutes."})
		return
	}
	locale := c.DefaultQuery("locale", "cn")
	if cached := getLalemDigestCache(locale); cached != nil {
		c.JSON(http.StatusOK, cached)
		return
	}
	adviser, ok := aiService.(lalemAdviser)
	if !ok {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "lounge digest is not available"})
		return
	}
	digest, err := adviser.AdviseLalemDigest(ai.LalemDigestInput{Locale: locale})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	setLalemDigestCache(locale, digest)
	c.JSON(http.StatusOK, digest)
}

func getLalemDigestCache(locale string) *ai.LalemDigest {
	key := localeCacheKey(locale)
	now := time.Now()
	lalemCacheMu.Lock()
	defer lalemCacheMu.Unlock()
	ent, ok := lalemDigestMem[key]
	if !ok || ent.digest == nil {
		return nil
	}
	if now.Sub(ent.at) > lalemCacheTTL {
		delete(lalemDigestMem, key)
		return nil
	}
	return ent.digest
}

func setLalemDigestCache(locale string, digest *ai.LalemDigest) {
	if digest == nil {
		return
	}
	key := localeCacheKey(locale)
	lalemCacheMu.Lock()
	defer lalemCacheMu.Unlock()
	lalemDigestMem[key] = lalemCacheEntry{digest: digest, at: time.Now()}
}

func localeCacheKey(locale string) string {
	if locale == "cn" || locale == "zh" {
		return "cn"
	}
	if locale == "en" {
		return "en"
	}
	// Keep unknown locales distinct but lowercase-ish.
	if locale == "" {
		return "cn"
	}
	return locale
}
