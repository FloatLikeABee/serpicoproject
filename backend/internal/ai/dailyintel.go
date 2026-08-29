package ai

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	defaultIntelInterval = 12 * time.Hour
	defaultPiecesPerRun  = 2
	maxPiecesPerDay      = 3
	maxNewsRetain        = 40
)

// IntelPieceKind routes collected material.
type IntelPieceKind string

const (
	IntelKindKnowledge IntelPieceKind = "knowledge"
	IntelKindNews      IntelPieceKind = "news"
)

// DailyIntelStatus is persisted for admin visibility.
type DailyIntelStatus struct {
	Enabled         bool      `json:"enabled"`
	LastRunAt       time.Time `json:"last_run_at,omitempty"`
	LastError       string    `json:"last_error,omitempty"`
	LastAdded       int       `json:"last_added"`
	LastNews        int       `json:"last_news"`
	LastKnowledge   int       `json:"last_knowledge"`
	RunsToday       int       `json:"runs_today"`
	PiecesToday     int       `json:"pieces_today"`
	DayKey          string    `json:"day_key"`
	NextRunAt       time.Time `json:"next_run_at,omitempty"`
	IntervalHours   float64   `json:"interval_hours"`
	PiecesPerRun    int       `json:"pieces_per_run"`
	MaxPiecesPerDay int       `json:"max_pieces_per_day"`
	Running         bool      `json:"running"`
}

// NewsDigestMeta indexes a saved markdown digest.
type NewsDigestMeta struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Location  string    `json:"location,omitempty"`
	SourceURL string    `json:"source_url,omitempty"`
	File      string    `json:"file"`
	CreatedAt time.Time `json:"created_at"`
	Summary   string    `json:"summary,omitempty"`
	Nation    string    `json:"nation,omitempty"`
}

// DailyIntelService collects worldwide crime intel twice daily.
type DailyIntelService struct {
	ai       *AIService
	dataPath string
	client   *http.Client
	enabled  bool
	interval time.Duration
	perRun   int

	mu      sync.Mutex
	running bool
	status  DailyIntelStatus
	seen    map[string]bool
	news    []NewsDigestMeta
	stopCh  chan struct{}
}

type intelRSSFeed struct {
	Channel struct {
		Items []struct {
			Title       string `xml:"title"`
			Link        string `xml:"link"`
			PubDate     string `xml:"pubDate"`
			Description string `xml:"description"`
			Source      struct {
				Value string `xml:",chardata"`
			} `xml:"source"`
		} `xml:"item"`
	} `xml:"channel"`
}

type intelHit struct {
	Title   string
	Link    string
	PubDate string
	Snippet string
	Source  string
}

type intelPick struct {
	SourceIndex int    `json:"source_index"`
	Kind        string `json:"kind"`
	Title       string `json:"title"`
	Location    string `json:"location"`
	Category    string `json:"category"`
	SummaryMD   string `json:"summary_md"`
	RAGContent  string `json:"rag_content"`
}

type intelPickResponse struct {
	Items []intelPick `json:"items"`
}

// NewDailyIntelService creates the collector. dataPath is usually data/intel.
func NewDailyIntelService(ai *AIService, dataPath string, enabled bool, intervalHours float64, piecesPerRun int) *DailyIntelService {
	if strings.TrimSpace(dataPath) == "" {
		dataPath = "data/intel"
	}
	if intervalHours <= 0 {
		intervalHours = 12
	}
	if piecesPerRun <= 0 {
		piecesPerRun = defaultPiecesPerRun
	}
	if piecesPerRun > maxPiecesPerDay {
		piecesPerRun = maxPiecesPerDay
	}

	s := &DailyIntelService{
		ai:       ai,
		dataPath: dataPath,
		client: &http.Client{
			Timeout: 25 * time.Second,
		},
		enabled:  enabled,
		interval: time.Duration(intervalHours * float64(time.Hour)),
		perRun:   piecesPerRun,
		seen:     map[string]bool{},
		news:     []NewsDigestMeta{},
		stopCh:   make(chan struct{}),
		status: DailyIntelStatus{
			Enabled:         enabled,
			IntervalHours:   intervalHours,
			PiecesPerRun:    piecesPerRun,
			MaxPiecesPerDay: maxPiecesPerDay,
		},
	}
	_ = os.MkdirAll(filepath.Join(dataPath, "news"), 0755)
	s.loadState()
	return s
}

// Start launches the twice-daily scheduler (non-blocking).
func (s *DailyIntelService) Start() {
	if s == nil || !s.enabled {
		log.Println("daily-intel: disabled")
		return
	}
	go s.loop()
	// Startup catch-up after a short delay so the API can come up first.
	go func() {
		time.Sleep(45 * time.Second)
		if err := s.Run(false); err != nil {
			log.Printf("daily-intel: startup run: %v", err)
		}
	}()
	log.Printf("daily-intel: scheduler started (every %s, up to %d pieces/run, max %d/day)",
		s.interval, s.perRun, maxPiecesPerDay)
}

// Stop ends the scheduler loop.
func (s *DailyIntelService) Stop() {
	if s == nil {
		return
	}
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
}

func (s *DailyIntelService) loop() {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			if err := s.Run(false); err != nil {
				log.Printf("daily-intel: scheduled run: %v", err)
			}
		}
	}
}

// Status returns a copy of the current status.
func (s *DailyIntelService) Status() DailyIntelStatus {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := s.status
	st.Running = s.running
	st.Enabled = s.enabled
	st.IntervalHours = s.interval.Hours()
	st.PiecesPerRun = s.perRun
	st.MaxPiecesPerDay = maxPiecesPerDay
	if !st.LastRunAt.IsZero() {
		st.NextRunAt = st.LastRunAt.Add(s.interval)
	} else {
		st.NextRunAt = time.Now().UTC().Add(45 * time.Second)
	}
	return st
}

// ListNews returns recent news digests (newest first).
func (s *DailyIntelService) ListNews(limit int) []NewsDigestMeta {
	return s.ListNewsNation("", limit)
}

func (s *DailyIntelService) ListNewsNation(nation string, limit int) []NewsDigestMeta {
	s.mu.Lock()
	defer s.mu.Unlock()
	filtered := s.news
	if nation != "" {
		want := ParseNation(nation)
		filtered = make([]NewsDigestMeta, 0, len(s.news))
		for _, n := range s.news {
			got := n.Nation
			if got == "" {
				got = "us"
			}
			if ParseNation(got) == want {
				filtered = append(filtered, n)
			}
		}
	}
	if limit <= 0 || limit > len(filtered) {
		limit = len(filtered)
	}
	out := make([]NewsDigestMeta, limit)
	copy(out, filtered[:limit])
	return out
}

// RecentNewsContext builds markdown for frontline chat injection (newest first).
func (s *DailyIntelService) RecentNewsContext(limit int) string {
	return s.NewsContextForQuery("", limit)
}

// NewsContextForQuery ranks admin MD digests by query relevance, falling back to newest.
func (s *DailyIntelService) NewsContextForQuery(query string, limit int) string {
	if limit <= 0 {
		limit = 3
	}
	items := s.ListNewsNation(nationFromContext(query), maxNewsRetain)
	if len(items) == 0 {
		return ""
	}

	type scored struct {
		item  NewsDigestMeta
		score int
	}
	queryWords := strings.Fields(strings.ToLower(strings.TrimSpace(query)))
	ranked := make([]scored, 0, len(items))
	for _, item := range items {
		score := 1 // keep recent items eligible even without keyword hits
		hay := strings.ToLower(item.Title + " " + item.Summary + " " + item.Location)
		for _, w := range queryWords {
			if len(w) < 3 {
				continue
			}
			if strings.Contains(hay, w) {
				score += 3
			}
		}
		ranked = append(ranked, scored{item: item, score: score})
	}
	for i := 0; i < len(ranked)-1; i++ {
		for j := i + 1; j < len(ranked); j++ {
			// Higher score first; for ties prefer newer (earlier in ListNews).
			if ranked[i].score < ranked[j].score {
				ranked[i], ranked[j] = ranked[j], ranked[i]
			}
		}
	}
	if len(ranked) > limit {
		ranked = ranked[:limit]
	}

	var b strings.Builder
	b.WriteString("### PRIORITY 1 — Admin news digests (Markdown from backstage collection)\n")
	b.WriteString("These are curated for frontline AI. Prefer them over supplemental web search.\n")
	for i, entry := range ranked {
		item := entry.item
		body := s.readNewsFile(item.File)
		if body == "" {
			body = item.Summary
		}
		b.WriteString(fmt.Sprintf("\n**[%d] %s**\n", i+1, item.Title))
		if item.Location != "" {
			b.WriteString(fmt.Sprintf("- Location: %s\n", item.Location))
		}
		if item.SourceURL != "" {
			b.WriteString(fmt.Sprintf("- Source: %s\n", item.SourceURL))
		}
		b.WriteString(body)
		b.WriteString("\n")
	}
	return b.String()
}

// HasDigestCoverage reports whether any admin digest looks relevant to the query.
func (s *DailyIntelService) HasDigestCoverage(query string) bool {
	if s == nil {
		return false
	}
	queryWords := strings.Fields(strings.ToLower(strings.TrimSpace(query)))
	if len(queryWords) == 0 {
		return len(s.ListNews(1)) > 0
	}
	for _, item := range s.ListNews(20) {
		hay := strings.ToLower(item.Title + " " + item.Summary + " " + item.Location)
		hits := 0
		for _, w := range queryWords {
			if len(w) < 3 {
				continue
			}
			if strings.Contains(hay, w) {
				hits++
			}
		}
		if hits >= 2 {
			return true
		}
	}
	return false
}

func (s *DailyIntelService) readNewsFile(name string) string {
	if name == "" {
		return ""
	}
	path := filepath.Join(s.dataPath, "news", name)
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

// Run executes one collection cycle. force bypasses the interval gate but still respects the daily piece cap.
func (s *DailyIntelService) Run(force bool) error {
	if s == nil {
		return fmt.Errorf("daily intel unavailable")
	}
	if !s.enabled && !force {
		return fmt.Errorf("daily intel disabled")
	}

	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("daily intel already running")
	}
	s.rollDayLocked()
	if !force && !s.status.LastRunAt.IsZero() && time.Since(s.status.LastRunAt) < s.interval-time.Minute {
		s.mu.Unlock()
		return fmt.Errorf("too soon since last run (interval %s)", s.interval)
	}
	target := s.perRun
	if !force {
		remaining := maxPiecesPerDay - s.status.PiecesToday
		if remaining <= 0 {
			s.mu.Unlock()
			return fmt.Errorf("daily piece cap reached (%d)", maxPiecesPerDay)
		}
		if target > remaining {
			target = remaining
		}
	}
	s.running = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	addedNews, addedKnowledge, err := s.collect(target, "us")
	cnNews, cnKnow, cnErr := s.collect(target, "cn")
	addedNews += cnNews
	addedKnowledge += cnKnow
	if err == nil {
		err = cnErr
	}
	s.mu.Lock()
	s.status.LastRunAt = time.Now().UTC()
	s.status.LastAdded = addedNews + addedKnowledge
	s.status.LastNews = addedNews
	s.status.LastKnowledge = addedKnowledge
	s.status.RunsToday++
	s.status.PiecesToday += addedNews + addedKnowledge
	s.status.NextRunAt = s.status.LastRunAt.Add(s.interval)
	if err != nil {
		s.status.LastError = err.Error()
	} else {
		s.status.LastError = ""
	}
	_ = s.saveStateLocked()
	s.mu.Unlock()
	return err
}

func (s *DailyIntelService) rollDayLocked() {
	day := time.Now().UTC().Format("2006-01-02")
	if s.status.DayKey != day {
		s.status.DayKey = day
		s.status.RunsToday = 0
		s.status.PiecesToday = 0
	}
}

func (s *DailyIntelService) collect(target int, nation string) (newsCount, knowledgeCount int, err error) {
	nation = ParseNation(nation)
	hits, err := s.gatherHits(nation)
	if err != nil {
		return 0, 0, err
	}

	// Drop already-seen titles.
	fresh := make([]intelHit, 0, len(hits))
	s.mu.Lock()
	for _, h := range hits {
		key := normalizeTitle(h.Title)
		if key == "" || s.seen[key] {
			continue
		}
		fresh = append(fresh, h)
	}
	s.mu.Unlock()
	if len(fresh) == 0 {
		return 0, 0, fmt.Errorf("no new headlines to process")
	}
	if len(fresh) > 24 {
		fresh = fresh[:24]
	}

	picks, err := s.pickWithAI(fresh, target, nation)
	if err != nil {
		return 0, 0, err
	}
	if len(picks) == 0 {
		return 0, 0, fmt.Errorf("AI selected no items")
	}

	for _, pick := range picks {
		if newsCount+knowledgeCount >= target {
			break
		}
		idx := pick.SourceIndex
		if idx < 0 || idx >= len(fresh) {
			continue
		}
		hit := fresh[idx]
		kind := IntelPieceKind(strings.ToLower(strings.TrimSpace(pick.Kind)))
		if kind != IntelKindKnowledge && kind != IntelKindNews {
			// Heuristic fallback.
			if looksLikeKnowledge(pick.Title + " " + pick.SummaryMD + " " + hit.Snippet) {
				kind = IntelKindKnowledge
			} else {
				kind = IntelKindNews
			}
		}

		title := strings.TrimSpace(pick.Title)
		if title == "" {
			title = hit.Title
		}

		switch kind {
		case IntelKindKnowledge:
			if err := s.saveKnowledge(pick, hit, title); err != nil {
				log.Printf("daily-intel: knowledge save: %v", err)
				continue
			}
			knowledgeCount++
		default:
			if err := s.saveNews(pick, hit, title, nation); err != nil {
				log.Printf("daily-intel: news save: %v", err)
				continue
			}
			newsCount++
		}

		s.mu.Lock()
		s.seen[normalizeTitle(hit.Title)] = true
		s.seen[normalizeTitle(title)] = true
		s.mu.Unlock()
	}

	if newsCount+knowledgeCount == 0 {
		return 0, 0, fmt.Errorf("failed to persist any selected pieces")
	}
	return newsCount, knowledgeCount, nil
}

func looksLikeKnowledge(text string) bool {
	lower := strings.ToLower(text)
	keys := []string{
		"case study", "lessons learned", "methodology", "how investigators",
		"forensic", "best practice", "profile", "historical", "solved after",
		"cold case solved", "breakthrough", "technique",
	}
	for _, k := range keys {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

func (s *DailyIntelService) saveKnowledge(pick intelPick, hit intelHit, title string) error {
	if s.ai == nil || s.ai.rag == nil {
		return fmt.Errorf("rag unavailable")
	}
	content := strings.TrimSpace(pick.RAGContent)
	if content == "" {
		content = strings.TrimSpace(pick.SummaryMD)
	}
	if content == "" {
		content = hit.Snippet
	}
	if content == "" {
		return fmt.Errorf("empty knowledge content")
	}
	category := strings.TrimSpace(pick.Category)
	if category == "" {
		category = "history"
	}
	id := fmt.Sprintf("rag-intel-%d", time.Now().UTC().UnixNano())
	doc := RAGDocument{
		ID:       id,
		Title:    title,
		Content:  content,
		Category: category,
		Location: strings.TrimSpace(pick.Location),
		Tags:     []string{"auto_intel", "knowledge", "crime", "worldwide"},
	}
	if hit.Link != "" {
		doc.Content = doc.Content + "\n\nSource: " + hit.Link
	}
	return s.ai.rag.AddDocument(doc)
}

func (s *DailyIntelService) saveNews(pick intelPick, hit intelHit, title, nation string) error {
	summary := strings.TrimSpace(pick.SummaryMD)
	if summary == "" {
		summary = fmt.Sprintf("**%s**\n\n%s", title, strings.TrimSpace(hit.Snippet))
	}
	if !strings.HasPrefix(summary, "#") {
		summary = "# " + title + "\n\n" + summary
	}
	if hit.Link != "" && !strings.Contains(summary, hit.Link) {
		summary += "\n\n**Source:** " + hit.Link + "\n"
	}

	ts := time.Now().UTC()
	id := fmt.Sprintf("news-%d", ts.UnixNano())
	slug := slugify(title)
	if slug == "" {
		slug = id
	}
	filename := fmt.Sprintf("%s-%s.md", ts.Format("2006-01-02"), slug)
	path := filepath.Join(s.dataPath, "news", filename)
	if err := os.WriteFile(path, []byte(summary), 0644); err != nil {
		return err
	}

	meta := NewsDigestMeta{
		ID:        id,
		Title:     title,
		Location:  strings.TrimSpace(pick.Location),
		SourceURL: hit.Link,
		File:      filename,
		CreatedAt: ts,
		Summary:   trimRunes(stripMD(summary), 280),
		Nation:    ParseNation(nation),
	}

	s.mu.Lock()
	s.news = append([]NewsDigestMeta{meta}, s.news...)
	if len(s.news) > maxNewsRetain {
		// Best-effort prune old files beyond retain window.
		extra := s.news[maxNewsRetain:]
		s.news = s.news[:maxNewsRetain]
		for _, old := range extra {
			_ = os.Remove(filepath.Join(s.dataPath, "news", old.File))
		}
	}
	_ = s.saveNewsIndexLocked()
	s.mu.Unlock()
	return nil
}

func (s *DailyIntelService) gatherHits(nation string) ([]intelHit, error) {
	queries := intelSearchQueries(nation)

	seen := map[string]bool{}
	var all []intelHit
	for _, q := range queries {
		hits, err := s.searchNews(q, 8, nation)
		if err != nil {
			log.Printf("daily-intel: rss %q: %v", q, err)
			continue
		}
		for _, h := range hits {
			key := normalizeTitle(h.Title)
			if key == "" || seen[key] {
				continue
			}
			seen[key] = true
			all = append(all, h)
		}
	}
	if len(all) == 0 {
		return nil, fmt.Errorf("no news hits from RSS")
	}
	return all, nil
}

func (s *DailyIntelService) searchNews(query string, limit int, nation string) ([]intelHit, error) {
	u := fmt.Sprintf(
		"https://news.google.com/rss/search?q=%s&%s",
		url.QueryEscape(query),
		googleNewsLocale(nation),
	)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; SerpicoIntel/1.0; +https://serpico.onrender.com)")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, */*")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("news rss %d: %s", resp.StatusCode, trimRunes(string(body), 200))
	}

	var feed intelRSSFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return nil, err
	}

	hits := make([]intelHit, 0, limit)
	for _, item := range feed.Channel.Items {
		if len(hits) >= limit {
			break
		}
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		hits = append(hits, intelHit{
			Title:   title,
			Link:    strings.TrimSpace(item.Link),
			PubDate: strings.TrimSpace(item.PubDate),
			Snippet: stripHTMLLite(item.Description),
			Source:  strings.TrimSpace(item.Source.Value),
		})
	}
	return hits, nil
}

func (s *DailyIntelService) pickWithAI(hits []intelHit, target int, nation string) ([]intelPick, error) {
	var listing strings.Builder
	for i, h := range hits {
		listing.WriteString(fmt.Sprintf("[%d] %s\n", i, h.Title))
		if h.Source != "" {
			listing.WriteString(fmt.Sprintf("    source: %s\n", h.Source))
		}
		if h.Snippet != "" {
			listing.WriteString(fmt.Sprintf("    snippet: %s\n", trimRunes(h.Snippet, 220)))
		}
		if h.Link != "" {
			listing.WriteString(fmt.Sprintf("    link: %s\n", h.Link))
		}
	}

	system := `You are Serpico's crime-intel curator for frontline police AI.
Select the strongest items from the candidate list.
Rules:
- Choose between 1 and TARGET items (inclusive). Prefer quality over quantity.
- Cover a mix when possible: US and international.
- Prefer: solved cold cases, new case studies with investigative lessons, significant crime news with operational value.
- Skip celebrity gossip, politics-only stories, and weak or duplicate blurbs.
- kind=knowledge when the piece teaches durable investigative knowledge (methods, solved-case lessons, profiles, forensic takeaways). Put a concise factual paragraph in rag_content suitable for a RAG knowledge base.
- kind=news for timely crime reporting. Put a short Markdown brief in summary_md (use " - " bullets separated by "\n", no hype).
- Always fill summary_md. For knowledge, also fill rag_content.
- category one of: history, strategy, perps, crime_stats, locations.
- location should be city/region/country when known, else "".
Output rules (critical):
- Return ONLY a single JSON object. No markdown fences. No commentary.
- Every string value MUST be one JSON line: escape newlines as \n, tabs as \t, and quotes as \".
Example shape:
{"items":[{"source_index":0,"kind":"news","title":"...","location":"...","category":"history","summary_md":"- point one\\n- point two","rag_content":""}]}`

	if ParseNation(nation) == "cn" {
		system = `你是 Serpico 的一线警情策展人。
从候选列表中选出最有价值的中国犯罪情报。
规则：
- 选择 1 到 TARGET 条。质量优先。
- 聚焦中国刑事案件、积案告破、在逃抓获、失踪协查。不要用美国 NamUs/FBI 稿件。
- 全部 title / summary_md / rag_content 使用简体中文。
- kind=knowledge 或 news。category 为 history, strategy, perps, crime_stats, locations 之一。
只返回一个 JSON 对象，不要 markdown。
{"items":[{"source_index":0,"kind":"news","title":"...","location":"...","category":"history","summary_md":"- 要点","rag_content":""}]}`
	}

	user := fmt.Sprintf("TARGET=%d\n\nCANDIDATES:\n%s", target, listing.String())
	raw, err := s.generate(system, user)
	if err != nil {
		return nil, err
	}

	parsed, err := parseIntelPicks(raw)
	if err != nil {
		// One repair pass: ask model to rewrite as strict single-line JSON.
		repairSystem := `Rewrite the following model output as STRICT valid JSON only.
No markdown fences. No commentary. Escape all newlines inside strings as \n.
Keep the same items/fields. Shape: {"items":[...]}`
		repaired, repairErr := s.generate(repairSystem, raw)
		if repairErr != nil {
			return nil, fmt.Errorf("parse AI picks: %w (%s)", err, trimRunes(raw, 240))
		}
		parsed, err = parseIntelPicks(repaired)
		if err != nil {
			return nil, fmt.Errorf("parse AI picks: %w (%s)", err, trimRunes(repaired, 240))
		}
	}

	// Clamp
	if len(parsed.Items) > target {
		parsed.Items = parsed.Items[:target]
	}
	return parsed.Items, nil
}

func parseIntelPicks(raw string) (intelPickResponse, error) {
	var parsed intelPickResponse
	jsonStr := sanitizeModelJSON(raw)
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		return parsed, err
	}
	return parsed, nil
}

// sanitizeModelJSON extracts a JSON object from model output and repairs common LLM mistakes
// like markdown fences and raw newlines inside string literals.
func sanitizeModelJSON(raw string) string {
	s := strings.TrimSpace(raw)
	// Strip fenced blocks: ```json ... ``` or ``` ... ```
	if i := strings.Index(s, "```"); i >= 0 {
		rest := s[i+3:]
		rest = strings.TrimSpace(rest)
		if strings.HasPrefix(strings.ToLower(rest), "json") {
			rest = strings.TrimSpace(rest[4:])
		}
		if j := strings.Index(rest, "```"); j >= 0 {
			rest = rest[:j]
		}
		s = strings.TrimSpace(rest)
	}
	s = extractJSONObject(s)
	return escapeRawControlsInJSONStrings(s)
}

// escapeRawControlsInJSONStrings escapes bare newline/tab/CR characters that appear inside
// JSON double-quoted strings (common LLM output that encoding/json rejects).
func escapeRawControlsInJSONStrings(s string) string {
	var b strings.Builder
	b.Grow(len(s) + 32)
	inString := false
	escaped := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if inString {
			if escaped {
				b.WriteByte(ch)
				escaped = false
				continue
			}
			if ch == '\\' {
				b.WriteByte(ch)
				escaped = true
				continue
			}
			if ch == '"' {
				b.WriteByte(ch)
				inString = false
				continue
			}
			switch ch {
			case '\n':
				b.WriteString(`\n`)
			case '\r':
				b.WriteString(`\r`)
			case '\t':
				b.WriteString(`\t`)
			default:
				b.WriteByte(ch)
			}
			continue
		}
		if ch == '"' {
			inString = true
		}
		b.WriteByte(ch)
	}
	return b.String()
}

func (s *DailyIntelService) generate(system, user string) (string, error) {
	if s.ai == nil {
		return "", fmt.Errorf("ai service unavailable")
	}
	return s.ai.generateWithLiveModel(system, user)
}

func (s *DailyIntelService) loadState() {
	statusPath := filepath.Join(s.dataPath, "status.json")
	if data, err := os.ReadFile(statusPath); err == nil {
		var st DailyIntelStatus
		if json.Unmarshal(data, &st) == nil {
			s.status = st
			s.status.Enabled = s.enabled
			s.status.IntervalHours = s.interval.Hours()
			s.status.PiecesPerRun = s.perRun
			s.status.MaxPiecesPerDay = maxPiecesPerDay
		}
	}
	s.rollDayLocked()

	seenPath := filepath.Join(s.dataPath, "seen.json")
	if data, err := os.ReadFile(seenPath); err == nil {
		var keys []string
		if json.Unmarshal(data, &keys) == nil {
			for _, k := range keys {
				s.seen[k] = true
			}
		}
	}

	indexPath := filepath.Join(s.dataPath, "news", "index.json")
	if data, err := os.ReadFile(indexPath); err == nil {
		var news []NewsDigestMeta
		if json.Unmarshal(data, &news) == nil {
			s.news = news
		}
	}
}

func (s *DailyIntelService) saveStateLocked() error {
	if err := os.MkdirAll(s.dataPath, 0755); err != nil {
		return err
	}
	statusPath := filepath.Join(s.dataPath, "status.json")
	data, err := json.MarshalIndent(s.status, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(statusPath, data, 0644); err != nil {
		return err
	}

	keys := make([]string, 0, len(s.seen))
	for k := range s.seen {
		keys = append(keys, k)
	}
	// Cap seen list growth.
	if len(keys) > 500 {
		keys = keys[len(keys)-500:]
		s.seen = map[string]bool{}
		for _, k := range keys {
			s.seen[k] = true
		}
	}
	seenData, err := json.MarshalIndent(keys, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(s.dataPath, "seen.json"), seenData, 0644); err != nil {
		return err
	}
	return s.saveNewsIndexLocked()
}

func (s *DailyIntelService) saveNewsIndexLocked() error {
	path := filepath.Join(s.dataPath, "news", "index.json")
	data, err := json.MarshalIndent(s.news, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func normalizeTitle(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.Join(strings.Fields(s), " ")
	return s
}

var nonSlugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = nonSlugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if len(s) > 48 {
		s = s[:48]
		s = strings.Trim(s, "-")
	}
	return s
}

func stripHTMLLite(s string) string {
	re := regexp.MustCompile(`<[^>]+>`)
	s = re.ReplaceAllString(s, " ")
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&#39;", "'")
	return strings.Join(strings.Fields(s), " ")
}

func stripMD(s string) string {
	s = strings.ReplaceAll(s, "#", "")
	s = strings.ReplaceAll(s, "*", "")
	return strings.Join(strings.Fields(s), " ")
}

func trimRunes(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
