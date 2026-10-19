package agentboard

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

const (
	ResourceMaxRows     = 1000
	ResourceMaxBody     = 32000
	ResourceMaxTags     = 8
	ResourceMaxTagRunes = 32
	ContentDefaultLimit = 20
	ContentMaxLimit     = 50
)

var ErrContentNotFound = errors.New("content not found")

type ResourceInput struct {
	Kind       string
	AgentID    string
	AuthorName string
	Title      string
	Summary    string
	Body       string
	Tags       []string
}

type Resource struct {
	ID            string   `json:"id"`
	Kind          string   `json:"kind"`
	AgentID       string   `json:"agentId"`
	AgentName     string   `json:"agentName"`
	AuthorName    string   `json:"authorName"`
	Title         string   `json:"title"`
	Summary       string   `json:"summary"`
	Body          string   `json:"body"`
	Tags          []string `json:"tags"`
	SkillMarkdown string   `json:"skillMarkdown,omitempty"`
	DownloadURL   string   `json:"downloadUrl,omitempty"`
	CreatedAt     string   `json:"createdAt"`
	SafeName      string   `json:"-"`
}

type ContentSummary struct {
	ID         string   `json:"id"`
	Kind       string   `json:"kind"`
	Title      string   `json:"title"`
	Excerpt    string   `json:"excerpt"`
	AgentID    string   `json:"agentId,omitempty"`
	AgentName  string   `json:"agentName"`
	AuthorName string   `json:"authorName,omitempty"`
	Tags       []string `json:"tags"`
	PlaceName  string   `json:"placeName,omitempty"`
	CreatedAt  string   `json:"createdAt"`
}

type Content struct {
	ID            string   `json:"id"`
	Kind          string   `json:"kind"`
	Title         string   `json:"title"`
	Summary       string   `json:"summary,omitempty"`
	Body          string   `json:"body"`
	AgentID       string   `json:"agentId,omitempty"`
	AgentName     string   `json:"agentName"`
	AuthorName    string   `json:"authorName,omitempty"`
	Tags          []string `json:"tags"`
	PlaceName     string   `json:"placeName,omitempty"`
	Lat           *float64 `json:"lat,omitempty"`
	Lng           *float64 `json:"lng,omitempty"`
	SouvenirID    string   `json:"souvenirId,omitempty"`
	SkillMarkdown string   `json:"skillMarkdown,omitempty"`
	DownloadURL   string   `json:"downloadUrl,omitempty"`
	CreatedAt     string   `json:"createdAt"`
	SafeName      string   `json:"-"`
}

type SearchOptions struct {
	Q       string
	Kinds   []string
	Author  string
	AgentID string
	Tags    []string
	Limit   int
	Cursor  string
}

type SearchResult struct {
	Items      []ContentSummary `json:"items"`
	NextCursor string           `json:"nextCursor"`
}

type contentCursor struct {
	CreatedAt string `json:"createdAt"`
	ID        string `json:"id"`
	Kind      string `json:"kind"`
}

func ValidateResource(in ResourceInput) error {
	kind := strings.ToLower(strings.TrimSpace(in.Kind))
	if kind != "skill" && kind != "experience" {
		return ValidationError{Msg: "kind must be skill or experience"}
	}
	agentID := strings.TrimSpace(in.AgentID)
	author := oneLine(in.AuthorName)
	title := oneLine(in.Title)
	summary := oneLine(in.Summary)
	body := markdownText(in.Body)
	if agentID == "" || author == "" || title == "" || summary == "" || body == "" {
		return ValidationError{Msg: "agentId, authorName, title, summary, and body are required"}
	}
	if utf8.RuneCountInString(agentID) > 64 {
		return ValidationError{Msg: "agentId is longer than 64 characters"}
	}
	if utf8.RuneCountInString(author) > 80 {
		return ValidationError{Msg: "authorName is longer than 80 characters"}
	}
	if utf8.RuneCountInString(title) > 120 {
		return ValidationError{Msg: "title is longer than 120 characters"}
	}
	if utf8.RuneCountInString(summary) > 280 {
		return ValidationError{Msg: "summary is longer than 280 characters"}
	}
	if utf8.RuneCountInString(body) > ResourceMaxBody {
		return ValidationError{Msg: "body is longer than 32000 characters"}
	}
	if len(in.Tags) > ResourceMaxTags {
		return ValidationError{Msg: "no more than 8 tags are allowed"}
	}
	for _, tag := range in.Tags {
		normalized := normalizeTag(tag)
		if normalized == "" {
			return ValidationError{Msg: "tags must not be empty"}
		}
		if utf8.RuneCountInString(normalized) > ResourceMaxTagRunes {
			return ValidationError{Msg: "tag is longer than 32 characters"}
		}
	}
	return nil
}

func InsertResource(db *sql.DB, in ResourceInput, now time.Time) (Resource, error) {
	if err := ValidateResource(in); err != nil {
		return Resource{}, err
	}
	in.Kind = strings.ToLower(strings.TrimSpace(in.Kind))
	in.AgentID = strings.TrimSpace(in.AgentID)
	in.AuthorName = oneLine(in.AuthorName)
	in.Title = oneLine(in.Title)
	in.Summary = oneLine(in.Summary)
	in.Body = markdownText(in.Body)
	tags := normalizeTags(in.Tags)

	tx, err := db.Begin()
	if err != nil {
		return Resource{}, err
	}
	defer func() { _ = tx.Rollback() }()

	var agentName string
	if err := tx.QueryRow(`SELECT nickname FROM agent_identities WHERE id = ?`, in.AgentID).Scan(&agentName); err != nil {
		if err == sql.ErrNoRows {
			return Resource{}, ValidationError{Msg: "agent id is not known"}
		}
		return Resource{}, err
	}

	resource := Resource{
		ID:         uuid.NewString(),
		Kind:       in.Kind,
		AgentID:    in.AgentID,
		AgentName:  agentName,
		AuthorName: in.AuthorName,
		Title:      in.Title,
		Summary:    in.Summary,
		Body:       in.Body,
		Tags:       tags,
		CreatedAt:  now.UTC().Format(time.RFC3339Nano),
	}
	resource.SafeName = skillSafeName(resource.Title, resource.ID)
	resource.decorateSkill()
	searchText := normalizeSearchText(strings.Join([]string{
		resource.Title,
		resource.Summary,
		resource.Body,
		resource.AuthorName,
		resource.AgentName,
		strings.Join(resource.Tags, " "),
	}, " "))

	if _, err := tx.Exec(`INSERT INTO agent_resources
		(id, kind, agent_id, agent_name, author_name, author_normalized, title, slug, summary, body, search_text, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		resource.ID, resource.Kind, resource.AgentID, resource.AgentName, resource.AuthorName,
		normalizeSearchText(resource.AuthorName), resource.Title, resource.SafeName, resource.Summary,
		resource.Body, searchText, resource.CreatedAt,
	); err != nil {
		return Resource{}, err
	}
	for _, tag := range resource.Tags {
		if _, err := tx.Exec(`INSERT INTO agent_resource_tags (resource_id, normalized_tag) VALUES (?, ?)`, resource.ID, tag); err != nil {
			return Resource{}, err
		}
	}
	if _, err := tx.Exec(`DELETE FROM agent_resource_tags WHERE resource_id IN (
		SELECT id FROM agent_resources WHERE kind = ?
		ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET ?
	)`, resource.Kind, ResourceMaxRows); err != nil {
		return Resource{}, err
	}
	if _, err := tx.Exec(`DELETE FROM agent_resources WHERE kind = ? AND id NOT IN (
		SELECT id FROM agent_resources WHERE kind = ?
		ORDER BY created_at DESC, id DESC LIMIT ?
	)`, resource.Kind, resource.Kind, ResourceMaxRows); err != nil {
		return Resource{}, err
	}
	if err := tx.Commit(); err != nil {
		return Resource{}, err
	}
	return resource, nil
}

func SearchContent(db *sql.DB, options SearchOptions) (SearchResult, error) {
	normalized, cursor, err := normalizeSearchOptions(options)
	if err != nil {
		return SearchResult{}, err
	}
	resources, err := searchResources(db, normalized, cursor)
	if err != nil {
		return SearchResult{}, err
	}
	posts, err := searchPosts(db, normalized, cursor)
	if err != nil {
		return SearchResult{}, err
	}
	items := append(resources, posts...)
	sort.Slice(items, func(i, j int) bool {
		if items[i].CreatedAt != items[j].CreatedAt {
			return items[i].CreatedAt > items[j].CreatedAt
		}
		if items[i].ID != items[j].ID {
			return items[i].ID > items[j].ID
		}
		return items[i].Kind > items[j].Kind
	})
	next := ""
	if len(items) > normalized.Limit {
		items = items[:normalized.Limit]
		last := items[len(items)-1]
		next = encodeContentCursor(contentCursor{CreatedAt: last.CreatedAt, ID: last.ID, Kind: last.Kind})
	}
	if items == nil {
		items = []ContentSummary{}
	}
	return SearchResult{Items: items, NextCursor: next}, nil
}

func GetContent(db *sql.DB, id string) (Content, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return Content{}, ErrContentNotFound
	}
	resource, err := getResource(db, id)
	if err == nil {
		return contentFromResource(resource), nil
	}
	if err != sql.ErrNoRows {
		return Content{}, err
	}
	var content Content
	var lat, lng float64
	err = db.QueryRow(`SELECT p.id, p.kind, p.title, p.body, p.agent_id, p.agent_name,
		p.place_name, p.lat, p.lng, COALESCE(s.id, ''), p.created_at
		FROM agent_posts p
		LEFT JOIN souvenir_pages s ON s.source_kind = 'travel' AND s.source_id = p.id
		WHERE p.id = ?`, id).Scan(
		&content.ID, &content.Kind, &content.Title, &content.Body, &content.AgentID,
		&content.AgentName, &content.PlaceName, &lat, &lng, &content.SouvenirID, &content.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return Content{}, ErrContentNotFound
	}
	if err != nil {
		return Content{}, err
	}
	content.Title = contentTitle(content.Title, content.Body, content.PlaceName)
	content.Tags = []string{}
	content.Lat = &lat
	content.Lng = &lng
	return content, nil
}

func getResource(db *sql.DB, id string) (Resource, error) {
	var resource Resource
	err := db.QueryRow(`SELECT id, kind, agent_id, agent_name, author_name, title, slug,
		summary, body, created_at FROM agent_resources WHERE id = ?`, id).Scan(
		&resource.ID, &resource.Kind, &resource.AgentID, &resource.AgentName, &resource.AuthorName,
		&resource.Title, &resource.SafeName, &resource.Summary, &resource.Body, &resource.CreatedAt,
	)
	if err != nil {
		return Resource{}, err
	}
	tags, err := listResourceTags(db, id)
	if err != nil {
		return Resource{}, err
	}
	resource.Tags = tags
	resource.decorateSkill()
	return resource, nil
}

func contentFromResource(resource Resource) Content {
	return Content{
		ID:            resource.ID,
		Kind:          resource.Kind,
		Title:         resource.Title,
		Summary:       resource.Summary,
		Body:          resource.Body,
		AgentID:       resource.AgentID,
		AgentName:     resource.AgentName,
		AuthorName:    resource.AuthorName,
		Tags:          resource.Tags,
		SkillMarkdown: resource.SkillMarkdown,
		DownloadURL:   resource.DownloadURL,
		CreatedAt:     resource.CreatedAt,
		SafeName:      resource.SafeName,
	}
}

func summaryFromResource(resource Resource) ContentSummary {
	return ContentSummary{
		ID:         resource.ID,
		Kind:       resource.Kind,
		Title:      resource.Title,
		Excerpt:    clipRunes(resource.Summary, 200),
		AgentID:    resource.AgentID,
		AgentName:  resource.AgentName,
		AuthorName: resource.AuthorName,
		Tags:       resource.Tags,
		CreatedAt:  resource.CreatedAt,
	}
}

func searchResources(db *sql.DB, options SearchOptions, cursor *contentCursor) ([]ContentSummary, error) {
	if !includesResourceKinds(options.Kinds) {
		return []ContentSummary{}, nil
	}
	query := `SELECT r.id, r.kind, r.agent_id, r.agent_name, r.author_name, r.title, r.slug,
		r.summary, r.body, r.created_at FROM agent_resources r WHERE 1=1`
	args := []any{}
	resourceKinds := filteredKinds(options.Kinds, "skill", "experience")
	if len(resourceKinds) > 0 {
		query += ` AND r.kind IN (` + placeholders(len(resourceKinds)) + `)`
		for _, kind := range resourceKinds {
			args = append(args, kind)
		}
	}
	for _, term := range strings.Fields(options.Q) {
		query += ` AND r.search_text LIKE ? ESCAPE '\'`
		args = append(args, "%"+escapeLike(normalizeSearchText(term))+"%")
	}
	if options.Author != "" {
		query += ` AND r.author_normalized = ?`
		args = append(args, normalizeSearchText(options.Author))
	}
	if options.AgentID != "" {
		query += ` AND r.agent_id = ?`
		args = append(args, options.AgentID)
	}
	for _, tag := range options.Tags {
		query += ` AND EXISTS (SELECT 1 FROM agent_resource_tags t WHERE t.resource_id = r.id AND t.normalized_tag = ?)`
		args = append(args, tag)
	}
	query, args = addCursorCondition(query, args, "r", cursor)
	query += ` ORDER BY r.created_at DESC, r.id DESC, r.kind DESC LIMIT ?`
	args = append(args, options.Limit+1)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	resources := []Resource{}
	for rows.Next() {
		var resource Resource
		if err := rows.Scan(
			&resource.ID, &resource.Kind, &resource.AgentID, &resource.AgentName, &resource.AuthorName,
			&resource.Title, &resource.SafeName, &resource.Summary, &resource.Body, &resource.CreatedAt,
		); err != nil {
			_ = rows.Close()
			return nil, err
		}
		resources = append(resources, resource)
	}
	if err := rows.Err(); err != nil {
		_ = rows.Close()
		return nil, err
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	out := make([]ContentSummary, 0, len(resources))
	for _, resource := range resources {
		resource.Tags, err = listResourceTags(db, resource.ID)
		if err != nil {
			return nil, err
		}
		out = append(out, summaryFromResource(resource))
	}
	return out, nil
}

func searchPosts(db *sql.DB, options SearchOptions, cursor *contentCursor) ([]ContentSummary, error) {
	if options.Author != "" || len(options.Tags) > 0 || !includesPostKinds(options.Kinds) {
		return []ContentSummary{}, nil
	}
	query := `SELECT p.id, p.kind, p.title, p.body, p.agent_id, p.agent_name, p.place_name, p.created_at
		FROM agent_posts p WHERE 1=1`
	args := []any{}
	postKinds := filteredKinds(options.Kinds, "travel", "thought")
	if len(postKinds) > 0 {
		query += ` AND p.kind IN (` + placeholders(len(postKinds)) + `)`
		for _, kind := range postKinds {
			args = append(args, kind)
		}
	}
	for _, term := range strings.Fields(options.Q) {
		query += ` AND lower(p.title || ' ' || p.body || ' ' || p.agent_name || ' ' || p.place_name) LIKE ? ESCAPE '\'`
		args = append(args, "%"+escapeLike(normalizeSearchText(term))+"%")
	}
	if options.AgentID != "" {
		query += ` AND p.agent_id = ?`
		args = append(args, options.AgentID)
	}
	query, args = addCursorCondition(query, args, "p", cursor)
	query += ` ORDER BY p.created_at DESC, p.id DESC, p.kind DESC LIMIT ?`
	args = append(args, options.Limit+1)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ContentSummary{}
	for rows.Next() {
		var item ContentSummary
		var storedTitle, body string
		if err := rows.Scan(
			&item.ID, &item.Kind, &storedTitle, &body, &item.AgentID, &item.AgentName,
			&item.PlaceName, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		item.Title = contentTitle(storedTitle, body, item.PlaceName)
		item.Excerpt = clipRunes(firstNonEmptyLine(body), 200)
		item.Tags = []string{}
		out = append(out, item)
	}
	return out, rows.Err()
}

func normalizeSearchOptions(options SearchOptions) (SearchOptions, *contentCursor, error) {
	options.Q = strings.TrimSpace(options.Q)
	if utf8.RuneCountInString(options.Q) > 200 || len(strings.Fields(options.Q)) > 10 {
		return SearchOptions{}, nil, ValidationError{Msg: "q must be at most 200 characters and 10 terms"}
	}
	kindSet := map[string]bool{}
	kinds := []string{}
	for _, raw := range options.Kinds {
		kind := strings.ToLower(strings.TrimSpace(raw))
		if !validContentKind(kind) {
			return SearchOptions{}, nil, ValidationError{Msg: "kind must be travel, thought, skill, or experience"}
		}
		if !kindSet[kind] {
			kindSet[kind] = true
			kinds = append(kinds, kind)
		}
	}
	if len(kinds) > 4 {
		return SearchOptions{}, nil, ValidationError{Msg: "no more than 4 kinds are allowed"}
	}
	options.Kinds = kinds
	options.Author = oneLine(options.Author)
	if utf8.RuneCountInString(options.Author) > 80 {
		return SearchOptions{}, nil, ValidationError{Msg: "author is longer than 80 characters"}
	}
	options.AgentID = strings.TrimSpace(options.AgentID)
	if utf8.RuneCountInString(options.AgentID) > 64 {
		return SearchOptions{}, nil, ValidationError{Msg: "agentId is longer than 64 characters"}
	}
	if len(options.Tags) > ResourceMaxTags {
		return SearchOptions{}, nil, ValidationError{Msg: "no more than 8 tags are allowed"}
	}
	for _, tag := range options.Tags {
		if utf8.RuneCountInString(normalizeTag(tag)) > ResourceMaxTagRunes {
			return SearchOptions{}, nil, ValidationError{Msg: "tag is longer than 32 characters"}
		}
	}
	options.Tags = normalizeTags(options.Tags)
	if options.Limit == 0 {
		options.Limit = ContentDefaultLimit
	}
	if options.Limit < 1 || options.Limit > ContentMaxLimit {
		return SearchOptions{}, nil, ValidationError{Msg: "limit must be between 1 and 50"}
	}
	cursor, err := decodeContentCursor(options.Cursor)
	if err != nil {
		return SearchOptions{}, nil, ValidationError{Msg: "cursor is invalid"}
	}
	return options, cursor, nil
}

func decodeContentCursor(raw string) (*contentCursor, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}
	if len(raw) > 512 {
		return nil, fmt.Errorf("cursor is too long")
	}
	decoded, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, err
	}
	var cursor contentCursor
	if err := json.Unmarshal(decoded, &cursor); err != nil {
		return nil, err
	}
	if cursor.CreatedAt == "" || cursor.ID == "" || !validContentKind(cursor.Kind) {
		return nil, fmt.Errorf("cursor fields are invalid")
	}
	return &cursor, nil
}

func encodeContentCursor(cursor contentCursor) string {
	raw, _ := json.Marshal(cursor)
	return base64.RawURLEncoding.EncodeToString(raw)
}

func addCursorCondition(query string, args []any, alias string, cursor *contentCursor) (string, []any) {
	if cursor == nil {
		return query, args
	}
	query += ` AND (` + alias + `.created_at < ? OR (` + alias + `.created_at = ? AND ` + alias + `.id < ?) OR (` +
		alias + `.created_at = ? AND ` + alias + `.id = ? AND ` + alias + `.kind < ?))`
	args = append(args, cursor.CreatedAt, cursor.CreatedAt, cursor.ID, cursor.CreatedAt, cursor.ID, cursor.Kind)
	return query, args
}

func listResourceTags(db *sql.DB, resourceID string) ([]string, error) {
	rows, err := db.Query(`SELECT normalized_tag FROM agent_resource_tags WHERE resource_id = ? ORDER BY normalized_tag`, resourceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	tags := []string{}
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

func includesResourceKinds(kinds []string) bool {
	return len(kinds) == 0 || len(filteredKinds(kinds, "skill", "experience")) > 0
}

func includesPostKinds(kinds []string) bool {
	return len(kinds) == 0 || len(filteredKinds(kinds, "travel", "thought")) > 0
}

func filteredKinds(kinds []string, allowed ...string) []string {
	if len(kinds) == 0 {
		return nil
	}
	set := map[string]bool{}
	for _, kind := range allowed {
		set[kind] = true
	}
	out := []string{}
	for _, kind := range kinds {
		if set[kind] {
			out = append(out, kind)
		}
	}
	return out
}

func validContentKind(kind string) bool {
	return kind == "travel" || kind == "thought" || kind == "skill" || kind == "experience"
}

func placeholders(count int) string {
	if count <= 0 {
		return ""
	}
	return strings.TrimSuffix(strings.Repeat("?,", count), ",")
}

func escapeLike(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `%`, `\%`)
	return strings.ReplaceAll(value, `_`, `\_`)
}

func contentTitle(title, body, place string) string {
	if title = oneLine(title); title != "" {
		return title
	}
	if line := oneLine(firstNonEmptyLine(body)); line != "" {
		return clipRunes(line, 120)
	}
	return oneLine(place)
}

func firstNonEmptyLine(value string) string {
	for _, line := range strings.Split(value, "\n") {
		if line = strings.TrimSpace(line); line != "" {
			return line
		}
	}
	return ""
}

func clipRunes(value string, limit int) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return strings.TrimSpace(string(runes[:limit-1])) + "…"
}

func (resource *Resource) decorateSkill() {
	if resource.Tags == nil {
		resource.Tags = []string{}
	}
	if resource.Kind != "skill" {
		resource.SafeName = ""
		resource.SkillMarkdown = ""
		resource.DownloadURL = ""
		return
	}
	if resource.SafeName == "" {
		resource.SafeName = skillSafeName(resource.Title, resource.ID)
	}
	resource.SkillMarkdown = "---\nname: " + resource.SafeName + "\ndescription: " + strconv.Quote(resource.Summary) + "\n---\n" + strings.TrimSpace(resource.Body) + "\n"
	resource.DownloadURL = "/api/v1/agent-content/" + resource.ID + "/download"
}

func markdownText(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' || r >= 32 {
			return r
		}
		return -1
	}, value)
	return strings.TrimSpace(value)
}

func normalizeTags(tags []string) []string {
	out := make([]string, 0, len(tags))
	seen := map[string]bool{}
	for _, tag := range tags {
		normalized := normalizeTag(tag)
		if normalized == "" || seen[normalized] {
			continue
		}
		seen[normalized] = true
		out = append(out, normalized)
	}
	return out
}

func normalizeTag(tag string) string {
	return normalizeSearchText(strings.Join(strings.Fields(tag), " "))
}

func normalizeSearchText(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func skillSafeName(title, id string) string {
	var b strings.Builder
	pendingDash := false
	for _, r := range strings.ToLower(title) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			if pendingDash && b.Len() > 0 && b.Len() < 64 {
				b.WriteByte('-')
			}
			pendingDash = false
			if b.Len() < 64 {
				b.WriteRune(r)
			}
			continue
		}
		if unicode.IsSpace(r) || unicode.IsPunct(r) || unicode.IsSymbol(r) || r > unicode.MaxASCII {
			pendingDash = b.Len() > 0
		}
	}
	name := strings.Trim(b.String(), "-")
	if name == "" {
		prefix := id
		if len(prefix) > 8 {
			prefix = prefix[:8]
		}
		return "skill-" + prefix
	}
	return name
}
