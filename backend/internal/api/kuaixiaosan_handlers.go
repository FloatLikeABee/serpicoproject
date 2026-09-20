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
	kuaixiaosanChatMax    = 8
	kuaixiaosanChatWindow = 10 * time.Minute
	kuaixiaosanChatMu     sync.Mutex
	kuaixiaosanChatHits   = map[string][]time.Time{}
)

func resetKuaixiaosanChatLimiter() {
	kuaixiaosanChatMu.Lock()
	defer kuaixiaosanChatMu.Unlock()
	kuaixiaosanChatHits = map[string][]time.Time{}
}

func kuaixiaosanChatLiveAllowed(ip string) bool {
	if ip == "" {
		ip = "unknown"
	}
	now := time.Now()
	cutoff := now.Add(-kuaixiaosanChatWindow)
	kuaixiaosanChatMu.Lock()
	defer kuaixiaosanChatMu.Unlock()
	hits := kuaixiaosanChatHits[ip]
	kept := hits[:0]
	for _, t := range hits {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= kuaixiaosanChatMax {
		kuaixiaosanChatHits[ip] = kept
		return false
	}
	kuaixiaosanChatHits[ip] = append(kept, now)
	return true
}

func handleKuaixiaosanStones(c *gin.Context) {
	f := ai.KuaixiaosanStoneFilter{
		Composition: c.Query("composition"),
		Site:        c.Query("site"),
		SizeClass:   c.Query("sizeClass"),
	}
	c.JSON(http.StatusOK, gin.H{"stones": ai.FilterKuaixiaosanStones(f)})
}

func handleKuaixiaosanCases(c *gin.Context) {
	f := ai.KuaixiaosanCaseFilter{Stage: c.Query("stage")}
	c.JSON(http.StatusOK, gin.H{"cases": ai.FilterKuaixiaosanCases(f)})
}

func handleKuaixiaosanRecover(c *gin.Context) {
	f := ai.KuaixiaosanRecoverFilter{Phase: c.Query("phase")}
	c.JSON(http.StatusOK, gin.H{"recover": ai.FilterKuaixiaosanRecover(f)})
}

func handleKuaixiaosanLore(c *gin.Context) {
	f := ai.KuaixiaosanLoreFilter{Topic: c.Query("topic")}
	c.JSON(http.StatusOK, gin.H{"articles": ai.FilterKuaixiaosanLore(f)})
}

func handleKuaixiaosanImaging(c *gin.Context) {
	f := ai.KuaixiaosanImagingFilter{Kind: c.Query("kind")}
	c.JSON(http.StatusOK, gin.H{"imaging": ai.FilterKuaixiaosanImaging(f)})
}

func handleKuaixiaosanWiki(c *gin.Context) {
	handleLalemWiki(c)
}

type kuaixiaosanChatAdviser interface {
	AdviseKuaixiaosanChat(in ai.KuaixiaosanChatInput) (*ai.KuaixiaosanChat, error)
}

func handleKuaixiaosanChat(c *gin.Context, aiService interface{}) {
	var req struct {
		Locale  string                   `json:"locale"`
		Message string                   `json:"message"`
		History []ai.KuaixiaosanChatTurn `json:"history"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		locale := localeCacheKey("cn")
		reply, _ := (&ai.KuaixiaosanAdvisor{}).AdviseKuaixiaosanChat(ai.KuaixiaosanChatInput{Locale: locale})
		replyKuaixiaosanChat(c, reply)
		return
	}
	locale := localeCacheKey(req.Locale)
	in := ai.KuaixiaosanChatInput{
		Locale:  locale,
		Message: strings.TrimSpace(req.Message),
		History: req.History,
	}
	if kuaixiaosanChatLiveAllowed(c.ClientIP()) {
		if adviser, ok := aiService.(kuaixiaosanChatAdviser); ok {
			reply, err := adviser.AdviseKuaixiaosanChat(in)
			if err == nil && reply != nil && strings.TrimSpace(reply.Reply) != "" {
				replyKuaixiaosanChat(c, reply)
				return
			}
		}
	}
	reply, err := (&ai.KuaixiaosanAdvisor{}).AdviseKuaixiaosanChat(in)
	if err != nil || reply == nil {
		reply = &ai.KuaixiaosanChat{Reply: "Sip water slowly and strain urine. This is not a diagnosis."}
		if locale == "cn" {
			reply = &ai.KuaixiaosanChat{Reply: "先小口喝水，滤过尿液。发热加腰痛要立刻就医。这不是诊断。"}
		}
	}
	replyKuaixiaosanChat(c, reply)
}

func replyKuaixiaosanChat(c *gin.Context, reply *ai.KuaixiaosanChat) {
	if reply == nil {
		c.JSON(http.StatusOK, ai.KuaixiaosanChat{Reply: "Sip water slowly and strain urine. This is not a diagnosis."})
		return
	}
	c.JSON(http.StatusOK, reply)
}
