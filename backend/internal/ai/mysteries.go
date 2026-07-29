package ai

import (
	"database/sql"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

const (
	mysteryCasesMax          = 50
	mysteryCasesRefreshEvery = 2 * time.Hour
	mysteryBriefRefreshEvery = 1 * time.Hour
)

// MysteryCase is a missing-person / cold-case / fugitive item for the feed.
type MysteryCase struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Category   string `json:"category"`
	Location   string `json:"location"`
	Date       string `json:"date"`
	Summary    string `json:"summary"`
	Status     string `json:"status"`
	SourceURL  string `json:"sourceUrl"`
	SourceName string `json:"sourceName"`
	LastUpdate string `json:"lastUpdate"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// MysteryBriefing is an AI-written case briefing (read-only for users).
type MysteryBriefing struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	BodyMD    string   `json:"bodyMd"`
	Sources   []string `json:"sources"`
	CreatedAt string   `json:"createdAt"`
}

// MysteryInsight is a user-submitted tip that passed AI fact-check.
type MysteryInsight struct {
	ID              string `json:"id"`
	AuthorName      string `json:"authorName"`
	Title           string `json:"title"`
	Body            string `json:"body"`
	Category        string `json:"category"`
	FactCheckStatus string `json:"factCheckStatus"`
	FactCheckNotes  string `json:"factCheckNotes"`
	CreatedAt       string `json:"createdAt"`
}

type MysteriesService struct {
	db     *sql.DB
	ai     *AIService
	mu     sync.Mutex
	client *http.Client

	casesLastRefresh    time.Time
	briefingLastRefresh time.Time
	refreshingCases     bool
	refreshingBriefing  bool
}

func NewMysteriesService(db *sql.DB, ai *AIService) *MysteriesService {
	s := &MysteriesService{
		db: db,
		ai: ai,
		client: &http.Client{
			Timeout: 25 * time.Second,
		},
	}
	go s.bootstrap()
	return s
}

func (s *MysteriesService) bootstrap() {
	time.Sleep(1500 * time.Millisecond)
	// Briefings and cases can load in parallel — don't block briefings on case retries.
	go func() {
		for attempt := 1; attempt <= 3; attempt++ {
			if err := s.RefreshBriefing(true); err != nil {
				log.Printf("mysteries: initial briefing refresh attempt %d: %v", attempt, err)
				_ = s.ensureStarterBriefing()
				time.Sleep(time.Duration(attempt*2) * time.Second)
				continue
			}
			return
		}
		_ = s.ensureStarterBriefing()
	}()

	for attempt := 1; attempt <= 4; attempt++ {
		if err := s.RefreshCases(true); err != nil {
			log.Printf("mysteries: initial cases refresh attempt %d: %v", attempt, err)
			if seedErr := s.ensureStarterCases(); seedErr != nil {
				log.Printf("mysteries: starter seed: %v", seedErr)
			}
			time.Sleep(time.Duration(attempt*3) * time.Second)
			continue
		}
		break
	}
}

func (s *MysteriesService) EnsureFresh() {
	s.mu.Lock()
	needCases := time.Since(s.casesLastRefresh) >= mysteryCasesRefreshEvery || s.casesLastRefresh.IsZero()
	needBrief := time.Since(s.briefingLastRefresh) >= mysteryBriefRefreshEvery || s.briefingLastRefresh.IsZero()
	s.mu.Unlock()

	if needCases {
		go func() {
			if err := s.RefreshCases(false); err != nil {
				log.Printf("mysteries: cases refresh: %v", err)
			}
		}()
	}
	if needBrief {
		go func() {
			if err := s.RefreshBriefing(false); err != nil {
				log.Printf("mysteries: briefing refresh: %v", err)
			}
		}()
	}
}

func (s *MysteriesService) Status() map[string]interface{} {
	s.mu.Lock()
	defer s.mu.Unlock()
	var caseCount, insightCount, briefingCount int
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM mystery_cases`).Scan(&caseCount)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM mystery_insights WHERE fact_check_status = 'verified'`).Scan(&insightCount)
	_ = s.db.QueryRow(`SELECT COUNT(*) FROM mystery_briefings`).Scan(&briefingCount)

	nextCases := s.casesLastRefresh.Add(mysteryCasesRefreshEvery)
	nextBrief := s.briefingLastRefresh.Add(mysteryBriefRefreshEvery)
	if s.casesLastRefresh.IsZero() {
		nextCases = time.Now()
	}
	if s.briefingLastRefresh.IsZero() {
		nextBrief = time.Now()
	}

	return map[string]interface{}{
		"caseCount":           caseCount,
		"insightCount":        insightCount,
		"briefingCount":       briefingCount,
		"casesLastRefresh":    formatTime(s.casesLastRefresh),
		"briefingLastRefresh": formatTime(s.briefingLastRefresh),
		"casesNextRefresh":    nextCases.UTC().Format(time.RFC3339),
		"briefingNextRefresh": nextBrief.UTC().Format(time.RFC3339),
		"casesRefreshing":     s.refreshingCases,
		"briefingRefreshing":  s.refreshingBriefing,
	}
}

func formatTime(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.UTC().Format(time.RFC3339)
}

// --- Google News RSS search ---

type rssFeed struct {
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	PubDate     string `xml:"pubDate"`
	Description string `xml:"description"`
	Source      struct {
		Value string `xml:",chardata"`
	} `xml:"source"`
}

type newsHit struct {
	Title   string
	Link    string
	PubDate string
	Snippet string
	Source  string
}

func (s *MysteriesService) searchNews(query string, limit int) ([]newsHit, error) {
	u := fmt.Sprintf(
		"https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en",
		url.QueryEscape(query),
	)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; SerpicoBoard/1.0; +https://serpico.onrender.com)")
	req.Header.Set("Accept", "application/rss+xml, application/xml, text/xml, */*")

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("news rss %d: %s", resp.StatusCode, string(body))
	}

	var feed rssFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return nil, err
	}

	hits := make([]newsHit, 0, limit)
	for _, item := range feed.Channel.Items {
		if len(hits) >= limit {
			break
		}
		title := strings.TrimSpace(item.Title)
		if title == "" {
			continue
		}
		snippet := stripHTML(item.Description)
		hits = append(hits, newsHit{
			Title:   title,
			Link:    strings.TrimSpace(item.Link),
			PubDate: strings.TrimSpace(item.PubDate),
			Snippet: snippet,
			Source:  strings.TrimSpace(item.Source.Value),
		})
	}
	return hits, nil
}

var htmlTagRe = regexp.MustCompile(`<[^>]+>`)

func stripHTML(s string) string {
	s = htmlTagRe.ReplaceAllString(s, " ")
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&#39;", "'")
	return strings.Join(strings.Fields(s), " ")
}

func (s *MysteriesService) gatherCaseNews() ([]newsHit, error) {
	queries := []string{
		`missing person United States`,
		`missing persons America police`,
		`cold case unsolved murder United States`,
		`fugitive wanted "at large" United States`,
		`unsolved crime police United States`,
		`"NamUs" missing`,
		`FBI most wanted United States`,
	}

	seen := map[string]bool{}
	var all []newsHit
	for _, q := range queries {
		hits, err := s.searchNews(q, 18)
		if err != nil {
			log.Printf("mysteries: search %q: %v", q, err)
			continue
		}
		for _, h := range hits {
			key := strings.ToLower(h.Title)
			if seen[key] {
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

type structuredCase struct {
	Title      string `json:"title"`
	Category   string `json:"category"`
	Location   string `json:"location"`
	Date       string `json:"date"`
	Summary    string `json:"summary"`
	Status     string `json:"status"`
	SourceURL  string `json:"sourceUrl"`
	SourceName string `json:"sourceName"`
}

func (s *MysteriesService) structureCases(hits []newsHit) ([]structuredCase, error) {
	if len(hits) > 40 {
		hits = hits[:40]
	}
	payload, _ := json.Marshal(hits)
	system := `You are a police intelligence analyst for Serpico.
From news headlines about US missing persons, cold cases, unsolved crimes, and fugitives on the run (last ~2 years), produce a JSON array of case cards.
Rules:
- ONLY include: missing_person, cold_case, unsolved_crime, fugitive
- Max 50 items, prefer the most recent and actionable
- Do NOT invent names, dates, or facts not supported by the headlines/snippets
- If location unknown use "United States"
- date as YYYY-MM-DD when possible, else year or "Unknown"
- status short: Missing / Unsolved / Wanted / Update / Cold Case
- summary: 1-2 factual sentences
- Keep sourceUrl and sourceName from the input when present
Return ONLY a JSON array of objects with keys:
title, category, location, date, summary, status, sourceUrl, sourceName
category must be one of: missing_person, cold_case, unsolved_crime, fugitive`

	user := fmt.Sprintf("Structure these news items into case cards:\n%s", string(payload))
	raw, err := s.generate(system, user)
	if err != nil {
		return nil, err
	}
	return parseJSONArray[structuredCase](raw)
}

func (s *MysteriesService) RefreshCases(force bool) error {
	s.mu.Lock()
	if s.refreshingCases {
		s.mu.Unlock()
		return nil
	}
	if !force && !s.casesLastRefresh.IsZero() && time.Since(s.casesLastRefresh) < mysteryCasesRefreshEvery {
		s.mu.Unlock()
		return nil
	}
	s.refreshingCases = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.refreshingCases = false
		s.mu.Unlock()
	}()

	hits, err := s.gatherCaseNews()
	if err != nil {
		log.Printf("mysteries: news gather failed: %v", err)
		if seedErr := s.ensureStarterCases(); seedErr != nil {
			return fmt.Errorf("%v; seed failed: %w", err, seedErr)
		}
		s.mu.Lock()
		s.casesLastRefresh = time.Now()
		s.mu.Unlock()
		return nil
	}

	cases, err := s.structureCases(hits)
	if err != nil || len(cases) == 0 {
		if err != nil {
			log.Printf("mysteries: AI structure failed, using raw headlines: %v", err)
		} else {
			log.Printf("mysteries: AI returned no cases, using raw headlines")
		}
		cases = fallbackCasesFromHits(hits)
	}

	cases = dedupeStructuredCases(cases)
	if len(cases) > mysteryCasesMax {
		cases = cases[:mysteryCasesMax]
	}
	if len(cases) == 0 {
		if seedErr := s.ensureStarterCases(); seedErr != nil {
			return fmt.Errorf("no cases after structuring: %w", seedErr)
		}
		s.mu.Lock()
		s.casesLastRefresh = time.Now()
		s.mu.Unlock()
		return nil
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM mystery_cases`); err != nil {
		_ = tx.Rollback()
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	stmt, err := tx.Prepare(`INSERT INTO mystery_cases
		(id, title, category, location, date, summary, status, source_url, source_name, last_update, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, c := range cases {
		cat := normalizeCategory(c.Category)
		id := "mc-" + uuid.New().String()[:8]
		_, err := stmt.Exec(
			id,
			trim(c.Title, 180),
			cat,
			trim(c.Location, 120),
			trim(c.Date, 32),
			trim(c.Summary, 600),
			trim(c.Status, 40),
			c.SourceURL,
			trim(c.SourceName, 80),
			now,
			now,
			now,
		)
		if err != nil {
			log.Printf("mysteries: insert case: %v", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	s.mu.Lock()
	s.casesLastRefresh = time.Now()
	s.mu.Unlock()
	log.Printf("mysteries: refreshed %d cases", len(cases))
	return nil
}

func fallbackCasesFromHits(hits []newsHit) []structuredCase {
	out := make([]structuredCase, 0, mysteryCasesMax)
	for _, h := range hits {
		if len(out) >= mysteryCasesMax {
			break
		}
		cat := guessCategory(h.Title + " " + h.Snippet)
		out = append(out, structuredCase{
			Title:      h.Title,
			Category:   cat,
			Location:   "United States",
			Date:       parseRSSDate(h.PubDate),
			Summary:    trim(h.Snippet, 400),
			Status:     "Update",
			SourceURL:  h.Link,
			SourceName: h.Source,
		})
	}
	return out
}

func guessCategory(text string) string {
	t := strings.ToLower(text)
	switch {
	case strings.Contains(t, "fugitive") || strings.Contains(t, "on the run") || strings.Contains(t, "wanted"):
		return "fugitive"
	case strings.Contains(t, "cold case"):
		return "cold_case"
	case strings.Contains(t, "missing"):
		return "missing_person"
	default:
		return "unsolved_crime"
	}
}

func normalizeCategory(c string) string {
	c = strings.ToLower(strings.TrimSpace(c))
	c = strings.ReplaceAll(c, " ", "_")
	c = strings.ReplaceAll(c, "-", "_")
	switch c {
	case "missing_person", "missing", "missing_persons":
		return "missing_person"
	case "cold_case", "coldcase":
		return "cold_case"
	case "fugitive", "suspect_on_run", "wanted":
		return "fugitive"
	case "unsolved_crime", "unsolved":
		return "unsolved_crime"
	default:
		return "unsolved_crime"
	}
}

func dedupeStructuredCases(cases []structuredCase) []structuredCase {
	seen := map[string]bool{}
	out := make([]structuredCase, 0, len(cases))
	for _, c := range cases {
		key := strings.ToLower(strings.TrimSpace(c.Title))
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, c)
	}
	return out
}

func parseRSSDate(raw string) string {
	formats := []string{time.RFC1123Z, time.RFC1123, time.RFC822Z, time.RFC822}
	for _, f := range formats {
		if t, err := time.Parse(f, raw); err == nil {
			return t.Format("2006-01-02")
		}
	}
	return time.Now().UTC().Format("2006-01-02")
}

func (s *MysteriesService) ListCases(category string) ([]MysteryCase, error) {
	s.EnsureFresh()
	list, err := s.queryCases(category)
	if err != nil {
		return nil, err
	}
	// First visitors often hit an empty DB while bootstrap is still running.
	// Never block the HTTP request on a full AI news scan — seed instantly and refresh async.
	if len(list) == 0 {
		_ = s.ensureStarterCases()
		list, err = s.queryCases(category)
		if err != nil {
			return nil, err
		}
		go func() {
			if refreshErr := s.RefreshCases(true); refreshErr != nil {
				log.Printf("mysteries: background cases refresh: %v", refreshErr)
			}
		}()
	}
	return list, err
}

func (s *MysteriesService) queryCases(category string) ([]MysteryCase, error) {
	q := `SELECT id, title, category, location, date, COALESCE(summary,''), COALESCE(status,''),
		COALESCE(source_url,''), COALESCE(source_name,''), COALESCE(last_update,''), created_at, updated_at
		FROM mystery_cases`
	args := []interface{}{}
	if category != "" && category != "all" {
		q += ` WHERE category = ?`
		args = append(args, normalizeCategory(category))
	}
	q += ` ORDER BY date DESC, updated_at DESC LIMIT ?`
	args = append(args, mysteryCasesMax)

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MysteryCase
	for rows.Next() {
		var c MysteryCase
		if err := rows.Scan(
			&c.ID, &c.Title, &c.Category, &c.Location, &c.Date, &c.Summary, &c.Status,
			&c.SourceURL, &c.SourceName, &c.LastUpdate, &c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, nil
}

func (s *MysteriesService) ensureStarterCases() error {
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM mystery_cases`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	starters := []structuredCase{
		{
			Title: "Active missing-person reports tracked nationwide",
			Category: "missing_person", Location: "United States", Date: time.Now().UTC().Format("2006-01-02"),
			Summary: "Police desks continue working recent missing-person cases across multiple states. Check NamUs and local PD bulletins for the latest confirmed updates.",
			Status: "Missing", SourceURL: "https://www.namus.gov/", SourceName: "NamUs",
		},
		{
			Title: "Cold case units reopen unsolved homicide files",
			Category: "cold_case", Location: "United States", Date: time.Now().UTC().AddDate(0, -1, 0).Format("2006-01-02"),
			Summary: "Investigators are applying modern DNA and genealogy methods to older unsolved murders. Agencies periodically release new public tips as forensic work advances.",
			Status: "Cold Case", SourceURL: "https://www.fbi.gov/wanted", SourceName: "FBI",
		},
		{
			Title: "Fugitives remain on federal and state wanted lists",
			Category: "fugitive", Location: "United States", Date: time.Now().UTC().AddDate(0, 0, -7).Format("2006-01-02"),
			Summary: "Multiple suspects wanted for violent crimes remain at large. Officers should review current FBI Most Wanted and state fugitive bulletins before patrol briefings.",
			Status: "Wanted", SourceURL: "https://www.fbi.gov/wanted/topten", SourceName: "FBI Most Wanted",
		},
		{
			Title: "Unsolved violent crimes still seeking public tips",
			Category: "unsolved_crime", Location: "United States", Date: time.Now().UTC().AddDate(0, -2, 0).Format("2006-01-02"),
			Summary: "Departments continue soliciting information on recent unsolved assaults and robberies. Tip lines and Crime Stoppers remain primary intake channels.",
			Status: "Unsolved", SourceURL: "https://crimestoppersusa.org/", SourceName: "Crime Stoppers",
		},
	}

	stmt, err := s.db.Prepare(`INSERT INTO mystery_cases
		(id, title, category, location, date, summary, status, source_url, source_name, last_update, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()
	for _, c := range starters {
		id := "mc-seed-" + uuid.New().String()[:8]
		if _, err := stmt.Exec(
			id, c.Title, c.Category, c.Location, c.Date, c.Summary, c.Status,
			c.SourceURL, c.SourceName, now, now, now,
		); err != nil {
			return err
		}
	}
	log.Printf("mysteries: seeded %d starter cases", len(starters))
	return nil
}

// --- Briefings (hourly AI digests) ---

func (s *MysteriesService) RefreshBriefing(force bool) error {
	s.mu.Lock()
	if s.refreshingBriefing {
		s.mu.Unlock()
		return nil
	}
	if !force && !s.briefingLastRefresh.IsZero() && time.Since(s.briefingLastRefresh) < mysteryBriefRefreshEvery {
		s.mu.Unlock()
		return nil
	}
	s.refreshingBriefing = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.refreshingBriefing = false
		s.mu.Unlock()
	}()

	queries := []string{
		`missing person update United States`,
		`cold case breakthrough United States`,
		`fugitive captured OR "still at large" United States`,
		`NamUs missing person`,
		`FBI most wanted United States`,
	}
	var hits []newsHit
	seen := map[string]bool{}
	for _, q := range queries {
		batch, err := s.searchNews(q, 10)
		if err != nil {
			log.Printf("mysteries: briefing search %q: %v", q, err)
			continue
		}
		for _, h := range batch {
			k := strings.ToLower(h.Title)
			if seen[k] {
				continue
			}
			seen[k] = true
			hits = append(hits, h)
		}
	}

	// Prefer live news; if RSS is empty, synthesize from stored case cards.
	var body, title string
	var sources []string

	if len(hits) > 0 {
		if len(hits) > 16 {
			hits = hits[:16]
		}
		payload, _ := json.Marshal(hits)
		system := `You are Officer Serpico writing a confidential case briefing for police training.
Using ONLY the provided news items about US missing persons, cold cases, unsolved crimes, and fugitives:
Write a Markdown briefing with:
# title line
## Key Developments (3-6 bullets)
## Cases to Watch (2-4 short paragraphs)
## Officer Notes (1 short paragraph on investigative takeaways)
Rules: no fabrication; cite outlet names inline; factual tone; no paranormal/conspiracy content.
Also return a JSON block AFTER the markdown, separated by a line containing only ---JSON---
JSON shape: {"title":"...","sources":["url1","url2"]}`

		user := fmt.Sprintf("Write this hour's briefing from:\n%s", string(payload))
		raw, err := s.generate(system, user)
		if err != nil {
			log.Printf("mysteries: briefing AI failed, using template: %v", err)
			title, body, sources = templateBriefingFromHits(hits)
		} else {
			var meta briefingMeta
			body, meta = splitBriefing(raw)
			title = meta.Title
			sources = meta.Sources
			if strings.TrimSpace(body) == "" {
				title, body, sources = templateBriefingFromHits(hits)
			}
		}
		if len(sources) == 0 {
			for _, h := range hits {
				if h.Link != "" {
					sources = append(sources, h.Link)
				}
				if len(sources) >= 8 {
					break
				}
			}
		}
	} else {
		cases, _ := s.queryCases("all")
		if len(cases) > 0 {
			title, body, sources = templateBriefingFromCases(cases)
		} else {
			return s.ensureStarterBriefing()
		}
	}

	if title == "" {
		title = "Case Briefing — " + time.Now().UTC().Format("Jan 2, 2006 15:04 UTC")
	}
	if strings.TrimSpace(body) == "" {
		return s.ensureStarterBriefing()
	}

	if err := s.insertBriefing(title, body, sources); err != nil {
		return err
	}

	s.mu.Lock()
	s.briefingLastRefresh = time.Now()
	s.mu.Unlock()
	return nil
}

func (s *MysteriesService) insertBriefing(title, body string, sources []string) error {
	if sources == nil {
		sources = []string{}
	}
	sourcesJSON, _ := json.Marshal(sources)
	id := "mb-" + uuid.New().String()[:8]
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := s.db.Exec(
		`INSERT INTO mystery_briefings (id, title, body_md, sources_json, created_at) VALUES (?, ?, ?, ?, ?)`,
		id, trim(title, 200), body, string(sourcesJSON), now,
	); err != nil {
		return err
	}

	// SQLite-safe prune: keep newest 24 via nested select.
	_, _ = s.db.Exec(`DELETE FROM mystery_briefings WHERE id NOT IN (
		SELECT id FROM (
			SELECT id FROM mystery_briefings ORDER BY created_at DESC LIMIT 24
		)
	)`)
	log.Printf("mysteries: new briefing %s", id)
	return nil
}

func templateBriefingFromHits(hits []newsHit) (title, body string, sources []string) {
	title = "Case Briefing — " + time.Now().UTC().Format("Jan 2, 2006 15:04 UTC")
	var b strings.Builder
	b.WriteString("# ")
	b.WriteString(title)
	b.WriteString("\n\n## Key Developments\n")
	limit := len(hits)
	if limit > 6 {
		limit = 6
	}
	for i := 0; i < limit; i++ {
		src := hits[i].Source
		if src == "" {
			src = "News"
		}
		b.WriteString(fmt.Sprintf("- **%s** — %s\n", src, hits[i].Title))
		if hits[i].Link != "" {
			sources = append(sources, hits[i].Link)
		}
	}
	b.WriteString("\n## Cases to Watch\n")
	for i := 0; i < limit && i < 4; i++ {
		snippet := hits[i].Snippet
		if snippet == "" {
			snippet = hits[i].Title
		}
		b.WriteString(fmt.Sprintf("**%s.** %s\n\n", hits[i].Title, trim(snippet, 280)))
	}
	b.WriteString("## Officer Notes\n")
	b.WriteString("Monitor missing-person, cold-case, and fugitive bulletins this hour. Cross-check tips against NamUs and current wanted lists before acting.\n")
	return title, b.String(), sources
}

func templateBriefingFromCases(cases []MysteryCase) (title, body string, sources []string) {
	title = "Desk Briefing — " + time.Now().UTC().Format("Jan 2, 2006 15:04 UTC")
	var b strings.Builder
	b.WriteString("# ")
	b.WriteString(title)
	b.WriteString("\n\n## Key Developments\n")
	limit := len(cases)
	if limit > 6 {
		limit = 6
	}
	for i := 0; i < limit; i++ {
		c := cases[i]
		b.WriteString(fmt.Sprintf("- **%s** (%s) — %s\n", c.Title, c.Status, c.Location))
		if c.SourceURL != "" {
			sources = append(sources, c.SourceURL)
		}
	}
	b.WriteString("\n## Cases to Watch\n")
	for i := 0; i < limit && i < 4; i++ {
		c := cases[i]
		b.WriteString(fmt.Sprintf("**%s.** %s\n\n", c.Title, trim(c.Summary, 280)))
	}
	b.WriteString("## Officer Notes\n")
	b.WriteString("These items are drawn from the live Board case feed. Refresh the Case Feed tab for source links and status updates.\n")
	return title, b.String(), sources
}

func (s *MysteriesService) ensureStarterBriefing() error {
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM mystery_briefings`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		s.mu.Lock()
		if s.briefingLastRefresh.IsZero() {
			s.briefingLastRefresh = time.Now()
		}
		s.mu.Unlock()
		return nil
	}

	title := "Board Desk Online — Initial Briefing"
	body := `# Board Desk Online — Initial Briefing

## Key Developments
- Board is scanning US missing-person, cold-case, unsolved-crime, and fugitive news.
- Public tip channels (NamUs, Crime Stoppers, FBI Wanted) remain primary intake for actionable leads.
- Cold-case units continue applying DNA / genetic genealogy where samples exist.
- Fugitive bulletins should be reviewed at shift briefings.

## Cases to Watch
**Missing persons.** Prioritize recent disappearances with confirmed last-known locations and time windows under 72 hours.

**Cold cases.** Watch for forensic updates that reopen older unsolved homicides.

**Fugitives.** Cross-check local BOLO traffic against federal and state wanted lists.

## Officer Notes
This starter briefing appears when live news digest is still warming up. A fuller AI briefing will replace it on the next successful scan.
`
	sources := []string{
		"https://www.namus.gov/",
		"https://www.fbi.gov/wanted",
		"https://crimestoppersusa.org/",
	}
	if err := s.insertBriefing(title, body, sources); err != nil {
		return err
	}
	s.mu.Lock()
	s.briefingLastRefresh = time.Now()
	s.mu.Unlock()
	return nil
}

type briefingMeta struct {
	Title   string   `json:"title"`
	Sources []string `json:"sources"`
}

func splitBriefing(raw string) (string, briefingMeta) {
	parts := strings.Split(raw, "---JSON---")
	body := strings.TrimSpace(parts[0])
	var meta briefingMeta
	if len(parts) > 1 {
		_ = json.Unmarshal([]byte(extractJSONObject(parts[1])), &meta)
	}
	// If the model put a markdown H1 first, use it as title when JSON title missing.
	if meta.Title == "" {
		for _, line := range strings.Split(body, "\n") {
			line = strings.TrimSpace(line)
			if strings.HasPrefix(line, "# ") {
				meta.Title = strings.TrimSpace(strings.TrimPrefix(line, "# "))
				break
			}
		}
	}
	return body, meta
}

func (s *MysteriesService) ListBriefings(limit int) ([]MysteryBriefing, error) {
	s.EnsureFresh()
	if limit <= 0 || limit > 24 {
		limit = 12
	}
	list, err := s.queryBriefings(limit)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		_ = s.ensureStarterBriefing()
		list, err = s.queryBriefings(limit)
		if err != nil {
			return nil, err
		}
		go func() {
			if refreshErr := s.RefreshBriefing(true); refreshErr != nil {
				log.Printf("mysteries: background briefing refresh: %v", refreshErr)
			}
		}()
	}
	return list, err
}

func (s *MysteriesService) queryBriefings(limit int) ([]MysteryBriefing, error) {
	rows, err := s.db.Query(
		`SELECT id, title, body_md, COALESCE(sources_json,'[]'), created_at
		 FROM mystery_briefings ORDER BY created_at DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MysteryBriefing
	for rows.Next() {
		var b MysteryBriefing
		var sourcesJSON string
		if err := rows.Scan(&b.ID, &b.Title, &b.BodyMD, &sourcesJSON, &b.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(sourcesJSON), &b.Sources)
		if b.Sources == nil {
			b.Sources = []string{}
		}
		list = append(list, b)
	}
	return list, nil
}

func (s *MysteriesService) LatestBriefing() (*MysteryBriefing, error) {
	list, err := s.queryBriefings(1)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, nil
	}
	return &list[0], nil
}

// --- Insights + fact check ---

type factCheckResult struct {
	Approved bool   `json:"approved"`
	Status   string `json:"status"`
	Notes    string `json:"notes"`
	Title    string `json:"title"`
	Body     string `json:"body"`
}

func (s *MysteriesService) FactCheckAndSubmit(author, title, body, category string) (*MysteryInsight, error) {
	author = trim(author, 60)
	title = trim(title, 160)
	body = trim(body, 2000)
	category = normalizeCategory(category)
	if author == "" {
		author = "Anonymous Officer"
	}
	if title == "" || body == "" {
		return nil, fmt.Errorf("title and body are required")
	}

	system := `You are a fact-checking desk for Serpico Mysteries.
Evaluate a user tip about a US missing person, cold case, unsolved crime, or fugitive.
Reject: paranormal, conspiracy theories, jokes, hate, doxxing private civilians, unverifiable wild claims, medical advice.
Approve only if the tip is plausible, non-harmful, and relevant to missing persons / cold cases / unsolved crimes / fugitives.
Return ONLY JSON:
{"approved":true|false,"status":"verified"|"rejected","notes":"short reason","title":"cleaned title","body":"cleaned body"}
You may lightly clean grammar but do not invent facts.`

	user := fmt.Sprintf("Author: %s\nCategory: %s\nTitle: %s\nBody: %s", author, category, title, body)
	raw, err := s.generate(system, user)
	if err != nil {
		return nil, fmt.Errorf("fact-check unavailable: %w", err)
	}

	var fc factCheckResult
	if err := json.Unmarshal([]byte(extractJSONObject(raw)), &fc); err != nil {
		return nil, fmt.Errorf("fact-check parse failed")
	}
	if fc.Status == "" {
		if fc.Approved {
			fc.Status = "verified"
		} else {
			fc.Status = "rejected"
		}
	}
	if fc.Title != "" {
		title = trim(fc.Title, 160)
	}
	if fc.Body != "" {
		body = trim(fc.Body, 2000)
	}

	id := "mi-" + uuid.New().String()[:8]
	now := time.Now().UTC().Format(time.RFC3339)
	insight := &MysteryInsight{
		ID:              id,
		AuthorName:      author,
		Title:           title,
		Body:            body,
		Category:        category,
		FactCheckStatus: fc.Status,
		FactCheckNotes:  trim(fc.Notes, 400),
		CreatedAt:       now,
	}

	if !fc.Approved && fc.Status != "verified" {
		insight.FactCheckStatus = "rejected"
		return insight, nil
	}

	_, err = s.db.Exec(
		`INSERT INTO mystery_insights (id, author_name, title, body, category, fact_check_status, fact_check_notes, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		insight.ID, insight.AuthorName, insight.Title, insight.Body, insight.Category,
		"verified", insight.FactCheckNotes, insight.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	insight.FactCheckStatus = "verified"
	return insight, nil
}

func (s *MysteriesService) ListInsights(limit int) ([]MysteryInsight, error) {
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	rows, err := s.db.Query(
		`SELECT id, author_name, title, body, COALESCE(category,''), fact_check_status,
		 COALESCE(fact_check_notes,''), created_at
		 FROM mystery_insights WHERE fact_check_status = 'verified'
		 ORDER BY created_at DESC LIMIT ?`, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []MysteryInsight
	for rows.Next() {
		var i MysteryInsight
		if err := rows.Scan(
			&i.ID, &i.AuthorName, &i.Title, &i.Body, &i.Category,
			&i.FactCheckStatus, &i.FactCheckNotes, &i.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, i)
	}
	return list, nil
}

// --- helpers ---

func (s *MysteriesService) generate(system, user string) (string, error) {
	if s.ai == nil {
		return "", fmt.Errorf("ai service unavailable")
	}
	text, err := s.ai.gemini.GenerateWithPrompt(system, user)
	if err == nil && strings.TrimSpace(text) != "" {
		return text, nil
	}
	log.Printf("mysteries: gemini error: %v", err)
	return s.ai.mistral.GenerateWithPrompt(system, user)
}

func trim(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func extractJSONObject(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func extractJSONArray(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	s = strings.TrimSpace(s)
	start := strings.Index(s, "[")
	end := strings.LastIndex(s, "]")
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func parseJSONArray[T any](raw string) ([]T, error) {
	var out []T
	if err := json.Unmarshal([]byte(extractJSONArray(raw)), &out); err != nil {
		return nil, err
	}
	return out, nil
}
