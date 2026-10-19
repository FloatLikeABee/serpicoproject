package api

import (
	"errors"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"serpico/backend/internal/agentboard"
	"serpico/backend/internal/database"

	"github.com/gin-gonic/gin"
)

const (
	agentContentMax                   = 6
	agentContentWindow                = time.Hour
	agentContentMaxIPs                = 10000
	agentContentRequestMaxBytes int64 = 160 * 1024
)

var (
	agentContentMu   sync.Mutex
	agentContentHits = map[string][]time.Time{}
)

type agentContentRequest struct {
	Kind       string   `json:"kind"`
	AgentID    string   `json:"agentId"`
	AuthorName string   `json:"authorName"`
	Title      string   `json:"title"`
	Summary    string   `json:"summary"`
	Body       string   `json:"body"`
	Tags       []string `json:"tags"`
}

func resetAgentContentLimiter() {
	agentContentMu.Lock()
	defer agentContentMu.Unlock()
	agentContentHits = map[string][]time.Time{}
}

func agentContentAllowed(ip string, now time.Time) bool {
	cutoff := now.Add(-agentContentWindow)
	agentContentMu.Lock()
	defer agentContentMu.Unlock()
	for key, hits := range agentContentHits {
		active := hits[:0]
		for _, hit := range hits {
			if hit.After(cutoff) {
				active = append(active, hit)
			}
		}
		if len(active) == 0 {
			delete(agentContentHits, key)
		} else {
			agentContentHits[key] = active
		}
	}
	kept := agentContentHits[ip]
	if len(kept) >= agentContentMax {
		agentContentHits[ip] = kept
		return false
	}
	if len(kept) == 0 && len(agentContentHits) >= agentContentMaxIPs {
		return false
	}
	agentContentHits[ip] = append(kept, now)
	return true
}

func handleAgentContentCreate(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "store unavailable"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, agentContentRequestMaxBytes)
	var req agentContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	in := agentContentInput(req)
	if err := agentboard.ValidateResource(in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if _, err := agentboard.LookupIdentity(db.SQLite, in.AgentID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !agentContentAllowed(agentContentRateKey(c), time.Now()) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "too many publications"})
		return
	}
	resource, err := agentboard.InsertResource(db.SQLite, in, time.Now())
	if err != nil {
		var validation agentboard.ValidationError
		if errors.As(err, &validation) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not publish content"})
		return
	}
	c.JSON(http.StatusCreated, resource)
}

func agentContentRateKey(c *gin.Context) string {
	// Render services are not directly internet-reachable and Render documents
	// the first X-Forwarded-For entry as the real client IP.
	if strings.EqualFold(strings.TrimSpace(os.Getenv("RENDER")), "true") {
		for _, raw := range strings.Split(c.GetHeader("X-Forwarded-For"), ",") {
			candidate := strings.TrimSpace(raw)
			if net.ParseIP(candidate) != nil {
				return candidate
			}
		}
	}
	remote := strings.TrimSpace(c.Request.RemoteAddr)
	host, _, err := net.SplitHostPort(remote)
	if err == nil {
		remote = host
	}
	if remote == "" {
		return "unknown"
	}
	return remote
}

func handleAgentContentSearch(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusOK, agentboard.SearchResult{Items: []agentboard.ContentSummary{}})
		return
	}
	limit := 0
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "limit must be a number"})
			return
		}
		limit = parsed
	}
	result, err := agentboard.SearchContent(db.SQLite, agentboard.SearchOptions{
		Q:       c.Query("q"),
		Kinds:   c.QueryArray("kind"),
		Author:  c.Query("author"),
		AgentID: c.Query("agentId"),
		Tags:    c.QueryArray("tag"),
		Limit:   limit,
		Cursor:  c.Query("cursor"),
	})
	if err != nil {
		var validation agentboard.ValidationError
		if errors.As(err, &validation) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not search content"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func handleAgentContentGet(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	content, err := agentboard.GetContent(db.SQLite, c.Param("id"))
	if errors.Is(err, agentboard.ErrContentNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not get content"})
		return
	}
	c.JSON(http.StatusOK, content)
}

func handleAgentContentDownload(c *gin.Context, db *database.Database) {
	if db == nil || db.SQLite == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	content, err := agentboard.GetContent(db.SQLite, c.Param("id"))
	if err != nil || content.Kind != "skill" {
		if err != nil && !errors.Is(err, agentboard.ErrContentNotFound) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not get content"})
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.Header("Content-Disposition", `attachment; filename="`+content.SafeName+`-SKILL.md"`)
	c.Data(http.StatusOK, "text/markdown; charset=utf-8", []byte(content.SkillMarkdown))
}

func agentContentInput(req agentContentRequest) agentboard.ResourceInput {
	return agentboard.ResourceInput{
		Kind:       req.Kind,
		AgentID:    req.AgentID,
		AuthorName: req.AuthorName,
		Title:      req.Title,
		Summary:    req.Summary,
		Body:       req.Body,
		Tags:       req.Tags,
	}
}
