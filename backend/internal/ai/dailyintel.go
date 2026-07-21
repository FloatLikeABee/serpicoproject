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
	s.mu.Lock()
	defer s.mu.Unlock()
	if limit <= 0 || limit > len(s.news) {
		limit = len(s.news)
	}
	out := make([]NewsDigestMeta, limit)
	copy(out, s.news[:limit])
	return out
}

// RecentNewsContext builds markdown for frontline chat injection.
func (s *DailyIntelService) RecentNewsContext(limit int) string {
	items := s.ListNews(limit)
	if len(items) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("### Recent crime intel digests (auto-collected)\n")
	for i, item := range items {
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

	addedNews, addedKnowledge, err := s.collect(target)
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

func (s *DailyIntelService) collect(target int) (newsCount, knowledgeCount int, err error) {
	hits, err := s.gatherHits()
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

	picks, err := s.pickWithAI(fresh, target)
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
			if err := s.saveNews(pick, hit, title); err != nil {
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

func (s *DailyIntelService) saveNews(pick intelPick, hit intelHit, title string) error {
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

func (s *DailyIntelService) gatherHits() ([]intelHit, error) {
	queries := []string{
		`crime news United States`,
		`police investigation breakthrough`,
		`"cold case" solved`,
		`cold case solved murder`,
		`fugitive captured OR arrested`,
		`international crime police`,
		`major crime Europe OR Asia OR Africa OR "Latin America"`,
		`homicide investigation update`,
		`serial offender arrested`,
		`missing person found police`,
	}

	seen := map[string]bool{}
	var all []intelHit
	for _, q := range queries {
		hits, err := s.searchNews(q, 8)
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

func (s *DailyIntelService) searchNews(query string, limit int) ([]intelHit, error) {
	// Prefer English worldwide feed; still includes US + international wire stories.
	u := fmt.Sprintf(
		"https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en",
		url.QueryEscape(query),
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

func (s *DailyIntelService) pickWithAI(hits []intelHit, target int) ([]intelPick, error) {
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
- kind=news for timely crime reporting. Put a short Markdown brief in summary_md (3-6 bullets or short paragraphs, no hype).
- Always fill summary_md. For knowledge, also fill rag_content.
- category one of: history, strategy, perps, crime_stats, locations.
- location should be city/region/country when known, else "".
Return ONLY valid JSON:
{"items":[{"source_index":0,"kind":"news|knowledge","title":"...","location":"...","category":"history","summary_md":"...","rag_content":"..."}]}`

	user := fmt.Sprintf("TARGET=%d\n\nCANDIDATES:\n%s", target, listing.String())
	raw, err := s.generate(system, user)
	if err != nil {
		return nil, err
	}

	jsonStr := extractJSONObject(raw)
	var parsed intelPickResponse
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		return nil, fmt.Errorf("parse AI picks: %w (%s)", err, trimRunes(raw, 240))
	}

	// Clamp
	if len(parsed.Items) > target {
		parsed.Items = parsed.Items[:target]
	}
	return parsed.Items, nil
}

func (s *DailyIntelService) generate(system, user string) (string, error) {
	if s.ai == nil {
		return "", fmt.Errorf("ai service unavailable")
	}
	text, err := s.ai.gemini.GenerateWithPrompt(system, user)
	if err == nil && strings.TrimSpace(text) != "" {
		return text, nil
	}
	log.Printf("daily-intel: gemini error: %v", err)
	return s.ai.mistral.GenerateWithPrompt(system, user)
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
