package api

import (
	"net/http"
	"sync"
	"time"

	"serpico/backend/internal/ai"
	"serpico/backend/internal/database"

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

func handleLalemPapers(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"papers": ai.LalemPapers()})
}

func handleLalemMedicine(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"articles": ai.LalemMedicineArticles()})
}

type lalemAdviser interface {
	AdviseLalemDigest(in ai.LalemDigestInput) (*ai.LalemDigest, error)
}

func handleLalemDigest(c *gin.Context, db *database.Database, aiService interface{}) {
	locale := localeCacheKey(c.DefaultQuery("locale", "cn"))
	now := time.Now()
	if db != nil && db.SQLite != nil {
		_ = database.PruneLalemFeed(db.SQLite, now)
		if digest := lalemDigestFromStore(db, locale, true); digest != nil {
			replyLalemDigest(c, digest)
			return
		}
		needSeed, needInc := lalemFeedNeedsGeneration(db, locale, now)
		if needSeed || needInc {
			if !lalemAllowed(c.ClientIP()) {
				c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again in a few minutes."})
				return
			}
			adviser, ok := aiService.(lalemAdviser)
			if !ok {
				if needInc {
					if fallback := lalemDigestFromStore(db, locale, false); fallback != nil {
						replyLalemDigest(c, fallback)
						return
					}
				}
				c.JSON(http.StatusServiceUnavailable, gin.H{"error": "lounge digest is not available"})
				return
			}
			mode := ""
			if needInc {
				mode = "increment"
			}
			digest, err := adviser.AdviseLalemDigest(ai.LalemDigestInput{Locale: locale, Mode: mode})
			if needInc {
				if err != nil || digest == nil {
					if fallback := lalemDigestFromStore(db, locale, false); fallback != nil {
						replyLalemDigest(c, fallback)
						return
					}
					c.JSON(http.StatusInternalServerError, gin.H{"error": "lounge digest increment failed"})
					return
				}
				_ = persistLalemDigest(db, locale, digest, now)
				if composed := lalemDigestFromStore(db, locale, false); composed != nil {
					replyLalemDigest(c, composed)
					return
				}
				replyLalemDigest(c, digest)
				return
			}
			if err != nil || digest == nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "lounge digest is not available"})
				return
			}
			_ = persistLalemDigest(db, locale, digest, now)
			if composed := lalemDigestFromStore(db, locale, false); composed != nil {
				replyLalemDigest(c, composed)
				return
			}
			replyLalemDigest(c, digest)
			return
		}
	}
	if !lalemAllowed(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again in a few minutes."})
		return
	}
	if cached := getLalemDigestCache(locale); cached != nil {
		replyLalemDigest(c, cached)
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
	replyLalemDigest(c, digest)
}

func replyLalemDigest(c *gin.Context, digest *ai.LalemDigest) {
	if digest == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lounge digest is not available"})
		return
	}
	digest.Videos = []ai.LalemVideo{}
	c.JSON(http.StatusOK, digest)
}

func lalemFeedNeedsGeneration(db *database.Database, locale string, now time.Time) (needSeed, needInc bool) {
	if db == nil || db.SQLite == nil {
		return false, false
	}
	trends, err := database.ListLalemTrends(db.SQLite, locale)
	if err != nil {
		return false, false
	}
	useful, err := database.ListLalemUseful(db.SQLite, locale)
	if err != nil {
		return false, false
	}
	date, _, ok, err := database.GetLalemFeedMeta(db.SQLite, locale)
	if err != nil {
		return false, false
	}
	today := database.LalemShanghaiToday(now)
	if len(trends) == 0 && len(useful) == 0 {
		return true, false
	}
	if !ok || date < today {
		return false, true
	}
	return false, false
}

func persistLalemDigest(db *database.Database, locale string, digest *ai.LalemDigest, now time.Time) error {
	if db == nil || db.SQLite == nil || digest == nil {
		return nil
	}
	created := now
	if t, err := time.Parse(time.RFC3339, digest.GeneratedAt); err == nil {
		created = t
	}
	for _, tr := range digest.Trends {
		if err := database.InsertLalemTrend(db.SQLite, database.LalemTrendRow{
			Locale:    locale,
			Kind:      tr.Kind,
			Title:     tr.Title,
			Hook:      tr.Hook,
			ImageURL:  tr.ImageURL,
			Chips:     tr.Chips,
			CreatedAt: created,
		}); err != nil {
			return err
		}
	}
	for _, body := range digest.Useful {
		if err := database.InsertLalemUseful(db.SQLite, database.LalemUsefulRow{
			Locale:    locale,
			Body:      body,
			CreatedAt: created,
		}); err != nil {
			return err
		}
	}
	generated := digest.GeneratedAt
	if generated == "" {
		generated = now.UTC().Format(time.RFC3339)
	}
	return database.SetLalemFeedMeta(db.SQLite, locale, database.LalemShanghaiToday(now), generated)
}

func lalemDigestFromStore(db *database.Database, locale string, requireToday bool) *ai.LalemDigest {
	if db == nil || db.SQLite == nil {
		return nil
	}
	date, generated, ok, err := database.GetLalemFeedMeta(db.SQLite, locale)
	if requireToday {
		if err != nil || !ok || date != database.LalemShanghaiToday(time.Now()) {
			return nil
		}
	}
	trendRows, err := database.ListLalemTrends(db.SQLite, locale)
	if err != nil {
		return nil
	}
	usefulRows, err := database.ListLalemUseful(db.SQLite, locale)
	if err != nil {
		return nil
	}
	if len(trendRows) == 0 && len(usefulRows) == 0 {
		return nil
	}
	trends := make([]ai.LalemTrend, 0, len(trendRows))
	for _, row := range trendRows {
		trends = append(trends, ai.LalemTrend{
			Kind:     row.Kind,
			Title:    row.Title,
			Hook:     row.Hook,
			ImageURL: row.ImageURL,
			Chips:    row.Chips,
		})
	}
	useful := make([]string, 0, len(usefulRows))
	for _, row := range usefulRows {
		useful = append(useful, row.Body)
	}
	if generated == "" && len(trendRows) > 0 && !trendRows[0].CreatedAt.IsZero() {
		generated = trendRows[0].CreatedAt.UTC().Format(time.RFC3339)
	}
	return ai.ComposeStoredLalemDigest(locale, trends, useful, generated)
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
