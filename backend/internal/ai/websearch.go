package ai

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// WebSearchTool provides supplemental web search for frontline chat.
// Admin RAG + MD digests always take priority over these results.
type WebSearchTool struct {
	enabled bool
	client  *http.Client
}

func NewWebSearchTool(enabled bool) *WebSearchTool {
	return &WebSearchTool{
		enabled: enabled,
		client: &http.Client{
			Timeout: 12 * time.Second,
		},
	}
}

type webRSSFeed struct {
	Channel struct {
		Items []struct {
			Title       string `xml:"title"`
			Link        string `xml:"link"`
			Description string `xml:"description"`
			Source      struct {
				Value string `xml:",chardata"`
			} `xml:"source"`
		} `xml:"item"`
	} `xml:"channel"`
}

// Search returns supplemental crime/news hits. Prefer admin intel when both exist.
func (w *WebSearchTool) Search(query string) (string, error) {
	if !w.enabled {
		return "", fmt.Errorf("web search is disabled")
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return "", fmt.Errorf("empty query")
	}

	hits, err := w.searchNewsRSS(query, 5)
	if err != nil || len(hits) == 0 {
		// Soft fallback so chat still gets a secondary signal if RSS is down.
		return w.mockFallback(query), nil
	}

	var b strings.Builder
	b.WriteString("Supplemental headlines (not admin-curated):\n")
	for i, h := range hits {
		b.WriteString(fmt.Sprintf("%d. %s", i+1, h.Title))
		if h.Source != "" {
			b.WriteString(fmt.Sprintf(" (%s)", h.Source))
		}
		b.WriteString("\n")
		if h.Snippet != "" {
			b.WriteString("   ")
			b.WriteString(trimRunes(h.Snippet, 180))
			b.WriteString("\n")
		}
		if h.Link != "" {
			b.WriteString("   ")
			b.WriteString(h.Link)
			b.WriteString("\n")
		}
	}
	return b.String(), nil
}

type webHit struct {
	Title   string
	Link    string
	Snippet string
	Source  string
}

func (w *WebSearchTool) searchNewsRSS(query string, limit int) ([]webHit, error) {
	u := fmt.Sprintf(
		"https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en",
		url.QueryEscape(query),
	)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; SerpicoChat/1.0; +https://serpico.onrender.com)")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, */*")

	resp, err := w.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("news rss %d: %s", resp.StatusCode, trimRunes(string(body), 160))
	}

	var feed webRSSFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return nil, err
	}

	hits := make([]webHit, 0, limit)
	for _, item := range feed.Channel.Items {
		if len(hits) >= limit {
			break
		}
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		hits = append(hits, webHit{
			Title:   title,
			Link:    strings.TrimSpace(item.Link),
			Snippet: stripHTMLLite(item.Description),
			Source:  strings.TrimSpace(item.Source.Value),
		})
	}
	return hits, nil
}

func (w *WebSearchTool) mockFallback(query string) string {
	return fmt.Sprintf(
		"Supplemental web search unavailable for %q. Rely on admin RAG and news digests if present.",
		trimRunes(query, 80),
	)
}

// SearchNews searches for recent news articles (RSS-backed).
func (w *WebSearchTool) SearchNews(query string) (string, error) {
	return w.Search(query)
}
