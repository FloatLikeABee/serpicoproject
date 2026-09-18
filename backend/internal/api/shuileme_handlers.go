package api

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"serpico/backend/internal/ai"

	"github.com/gin-gonic/gin"
)

var (
	shuilemeChatMax    = 8
	shuilemeChatWindow = 10 * time.Minute
	shuilemeChatMu     sync.Mutex
	shuilemeChatHits   = map[string][]time.Time{}
)

func resetShuilemeChatLimiter() {
	shuilemeChatMu.Lock()
	defer shuilemeChatMu.Unlock()
	shuilemeChatHits = map[string][]time.Time{}
}

func shuilemeChatLiveAllowed(ip string) bool {
	if ip == "" {
		ip = "unknown"
	}
	now := time.Now()
	cutoff := now.Add(-shuilemeChatWindow)
	shuilemeChatMu.Lock()
	defer shuilemeChatMu.Unlock()
	hits := shuilemeChatHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= shuilemeChatMax {
		shuilemeChatHits[ip] = kept
		return false
	}
	shuilemeChatHits[ip] = append(kept, now)
	return true
}

func handleShuilemeBeds(c *gin.Context) {
	f := ai.ShuilemeBedFilter{
		Size: c.Query("size"),
		Fill: c.Query("fill"),
		Era:  c.Query("era"),
	}
	c.JSON(http.StatusOK, gin.H{"beds": ai.FilterShuilemeBeds(f)})
}

func handleShuilemeBedrooms(c *gin.Context) {
	f := ai.ShuilemeRoomFilter{
		Light:  c.Query("light"),
		Layout: c.Query("layout"),
	}
	c.JSON(http.StatusOK, gin.H{"bedrooms": ai.FilterShuilemeRooms(f)})
}

func handleShuilemeLore(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"articles": ai.ShuilemeLoreArticles()})
}

func handleShuilemeWiki(c *gin.Context) {
	handleLalemWiki(c)
}

type shuilemeChatAdviser interface {
	AdviseShuilemeChat(in ai.ShuilemeChatInput) (*ai.ShuilemeChat, error)
}

func handleShuilemeChat(c *gin.Context, aiService interface{}) {
	var req struct {
		Locale  string                `json:"locale"`
		Message string                `json:"message"`
		History []ai.ShuilemeChatTurn `json:"history"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		locale := localeCacheKey("cn")
		reply, _ := (&ai.ShuilemeAdvisor{}).AdviseShuilemeChat(ai.ShuilemeChatInput{Locale: locale})
		replyShuilemeChat(c, reply)
		return
	}
	locale := localeCacheKey(req.Locale)
	in := ai.ShuilemeChatInput{
		Locale:  locale,
		Message: strings.TrimSpace(req.Message),
		History: req.History,
	}
	if shuilemeChatLiveAllowed(c.ClientIP()) {
		if adviser, ok := aiService.(shuilemeChatAdviser); ok {
			reply, err := adviser.AdviseShuilemeChat(in)
			if err == nil && reply != nil && strings.TrimSpace(reply.Reply) != "" {
				replyShuilemeChat(c, reply)
				return
			}
		}
	}
	reply, err := (&ai.ShuilemeAdvisor{}).AdviseShuilemeChat(in)
	if err != nil || reply == nil {
		reply = &ai.ShuilemeChat{Reply: "One plus one is two. Short sentences."}
		if locale == "cn" {
			reply = &ai.ShuilemeChat{Reply: "加法可以左右交换。一加二等于二加一。句子短，读着慢。"}
		}
	}
	replyShuilemeChat(c, reply)
}

func replyShuilemeChat(c *gin.Context, reply *ai.ShuilemeChat) {
	if reply == nil {
		c.JSON(http.StatusOK, ai.ShuilemeChat{Reply: "One plus one is two. Short sentences."})
		return
	}
	c.JSON(http.StatusOK, reply)
}
