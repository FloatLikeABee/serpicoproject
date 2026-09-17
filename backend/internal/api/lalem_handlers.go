package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
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

	lalemCompMax    = 1
	lalemCompWindow = 8 * time.Minute
	lalemCompMu     sync.Mutex
	lalemCompHits   = map[string][]time.Time{}

	lalemCacheTTL  = time.Hour
	lalemCacheMu   sync.Mutex
	lalemDigestMem = map[string]lalemCacheEntry{}

	lalemWikiClient = &http.Client{Timeout: 8 * time.Second, CheckRedirect: lalemWikiCheckRedirect}
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

func resetLalemCompanionLimiter() {
	lalemCompMu.Lock()
	defer lalemCompMu.Unlock()
	lalemCompHits = map[string][]time.Time{}
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

func lalemCompanionLiveAllowed(ip string) bool {
	if ip == "" {
		ip = "unknown"
	}
	now := time.Now()
	cutoff := now.Add(-lalemCompWindow)
	lalemCompMu.Lock()
	defer lalemCompMu.Unlock()
	hits := lalemCompHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= lalemCompMax {
		lalemCompHits[ip] = kept
		return false
	}
	lalemCompHits[ip] = append(kept, now)
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

const lalemWikiUserAgent = "SerpicoLalem/1.0 (https://serpico.onrender.com/lalem; wiki-summary)"

func handleLalemWiki(c *gin.Context) {
	raw := strings.TrimSpace(c.Query("url"))
	host, title, ok := parseLalemWikiURL(raw)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported wiki url"})
		return
	}
	restTitle := strings.ReplaceAll(title, " ", "_")
	endpoint := "https://" + host + "/api/rest_v1/page/summary/" + url.PathEscape(restTitle)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "wiki summary unavailable"})
		return
	}
	req.Header.Set("User-Agent", lalemWikiUserAgent)
	req.Header.Set("Accept", "application/json")
	client := wikiHTTPClient()
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "wiki summary unavailable"})
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, resp.Body)
		c.JSON(http.StatusBadGateway, gin.H{"error": "wiki summary unavailable"})
		return
	}
	var payload struct {
		Title   string `json:"title"`
		Extract string `json:"extract"`
		Lang    string `json:"lang"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&payload); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "wiki summary unavailable"})
		return
	}
	lang := payload.Lang
	if lang == "" {
		if strings.HasPrefix(host, "zh.") {
			lang = "zh"
		} else {
			lang = "en"
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"title":     payload.Title,
		"extract":   payload.Extract,
		"lang":      lang,
		"sourceUrl": raw,
	})
}

func parseLalemWikiURL(raw string) (host, title string, ok bool) {
	if raw == "" {
		return "", "", false
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return "", "", false
	}
	host = strings.ToLower(u.Hostname())
	if host != "zh.wikipedia.org" && host != "en.wikipedia.org" {
		return "", "", false
	}
	path := strings.Trim(u.Path, "/")
	if !strings.HasPrefix(path, "wiki/") {
		return "", "", false
	}
	title = strings.TrimSpace(strings.TrimPrefix(path, "wiki/"))
	if title == "" {
		return "", "", false
	}
	return host, title, true
}

func wikiHTTPClient() *http.Client {
	base := lalemWikiClient
	if base == nil {
		base = &http.Client{Timeout: 8 * time.Second}
	}
	cp := *base
	cp.CheckRedirect = lalemWikiCheckRedirect
	if cp.Timeout == 0 {
		cp.Timeout = 8 * time.Second
	}
	return &cp
}

func lalemWikiCheckRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 3 {
		return errors.New("too many wiki redirects")
	}
	if req.URL.Scheme != "https" {
		return errors.New("wiki redirect must be https")
	}
	host := strings.ToLower(req.URL.Hostname())
	if host != "zh.wikipedia.org" && host != "en.wikipedia.org" {
		return errors.New("wiki redirect host not allowed")
	}
	return nil
}

type lalemAdviser interface {
	AdviseLalemDigest(in ai.LalemDigestInput) (*ai.LalemDigest, error)
}

type lalemCompanionAdviser interface {
	AdviseLalemCompanion(in ai.LalemCompanionInput) (*ai.LalemCompanion, error)
}

func handleLalemCompanion(c *gin.Context, aiService interface{}) {
	locale := localeCacheKey(c.DefaultQuery("locale", "cn"))
	liveOK := lalemCompanionLiveAllowed(c.ClientIP())
	if liveOK {
		if adviser, ok := aiService.(lalemCompanionAdviser); ok {
			line, err := adviser.AdviseLalemCompanion(ai.LalemCompanionInput{Locale: locale})
			if err == nil && line != nil && strings.TrimSpace(line.Text) != "" {
				replyLalemCompanion(c, line)
				return
			}
		}
	}
	line, err := (&ai.LalemAdvisor{}).AdviseLalemCompanion(ai.LalemCompanionInput{Locale: locale})
	if err != nil || line == nil {
		line = &ai.LalemCompanion{Text: "Wash with soap. Cute reminder, not a diagnosis.", Angle: "medical"}
		if locale == "cn" {
			line = &ai.LalemCompanion{Text: "洗手泡沫要盖住手心手背，这是便便科普，不是诊断。", Angle: "medical"}
		}
	}
	replyLalemCompanion(c, line)
}

func replyLalemCompanion(c *gin.Context, line *ai.LalemCompanion) {
	if line == nil {
		c.JSON(http.StatusOK, ai.LalemCompanion{Text: "Wash with soap. Cute reminder, not a diagnosis.", Angle: "medical"})
		return
	}
	c.JSON(http.StatusOK, line)
}

func handleLalemDigest(c *gin.Context, db *database.Database, aiService interface{}) {
	locale := localeCacheKey(c.DefaultQuery("locale", "cn"))
	now := time.Now()
	if db != nil && db.SQLite != nil {
		_ = database.PruneLalemFeed(db.SQLite, now)
		needSeed, needInc := lalemFeedNeedsGeneration(db, locale, now)
		if !needSeed {
			_ = ensureLalemTrendFloor(db, locale, now)
		}
		if digest := lalemDigestFromStore(db, locale, true); digest != nil {
			if lalemUniqueTrendCount(digest) >= ai.LalemTrendFloor && !needInc {
				replyLalemDigest(c, digest)
				return
			}
		}
		if needSeed || needInc {
			if !lalemAllowed(c.ClientIP()) {
				c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests. Try again in a few minutes."})
				return
			}
			adviser, ok := aiService.(lalemAdviser)
			if !ok {
				if needInc {
					_ = ensureLalemTrendFloor(db, locale, now)
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
				_ = ensureLalemTrendFloor(db, locale, now)
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
			digest.Trends = ai.PadLalemTrendsToFloor(digest.Trends, locale, ai.LalemTrendFloor)
			_ = persistLalemDigest(db, locale, digest, now)
			_ = ensureLalemTrendFloor(db, locale, now)
			if composed := lalemDigestFromStore(db, locale, false); composed != nil {
				replyLalemDigest(c, composed)
				return
			}
			replyLalemDigest(c, digest)
			return
		}
		if digest := lalemDigestFromStore(db, locale, false); digest != nil {
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

func lalemUniqueTrendCount(digest *ai.LalemDigest) int {
	if digest == nil {
		return 0
	}
	seen := map[string]struct{}{}
	for _, tr := range digest.Trends {
		title := strings.TrimSpace(tr.Title)
		if title == "" {
			continue
		}
		seen[title] = struct{}{}
	}
	return len(seen)
}

func ensureLalemTrendFloor(db *database.Database, locale string, now time.Time) error {
	if db == nil || db.SQLite == nil {
		return nil
	}
	rows, err := database.ListLalemTrends(db.SQLite, locale)
	if err != nil {
		return err
	}
	existing := make([]ai.LalemTrend, 0, len(rows))
	have := map[string]struct{}{}
	for _, row := range rows {
		title := strings.TrimSpace(row.Title)
		existing = append(existing, ai.LalemTrend{
			Kind:     row.Kind,
			Title:    title,
			Hook:     row.Hook,
			ImageURL: row.ImageURL,
			Chips:    row.Chips,
		})
		if title != "" {
			have[title] = struct{}{}
		}
	}
	padded := ai.PadLalemTrendsToFloor(existing, locale, ai.LalemTrendFloor)
	for _, tr := range padded {
		title := strings.TrimSpace(tr.Title)
		if title == "" {
			continue
		}
		if _, ok := have[title]; ok {
			continue
		}
		if err := database.InsertLalemTrend(db.SQLite, database.LalemTrendRow{
			Locale:    locale,
			Kind:      tr.Kind,
			Title:     tr.Title,
			Hook:      tr.Hook,
			ImageURL:  tr.ImageURL,
			Chips:     tr.Chips,
			CreatedAt: now,
		}); err != nil {
			return err
		}
		have[title] = struct{}{}
	}
	return nil
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
