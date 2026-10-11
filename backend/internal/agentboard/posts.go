package agentboard

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

const MaxRows = 200

type Post struct {
	ID         string  `json:"id"`
	Kind       string  `json:"kind"`
	AgentName  string  `json:"agentName"`
	PlaceName  string  `json:"placeName"`
	Title      string  `json:"title"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	Body       string  `json:"body"`
	Pixels     []int   `json:"pixels"`
	AgentID    string  `json:"agentId,omitempty"`
	Icon       string  `json:"icon,omitempty"`
	SouvenirID string  `json:"souvenirId,omitempty"`
	CreatedAt  string  `json:"createdAt"`
}

type PostInput struct {
	AgentName string
	PlaceName string
	Title     string
	Lat       float64
	Lng       float64
	Body      string
	Pixels    json.RawMessage
	ImageURL  string
	Photo     string
	AgentID   string
}

type ValidationError struct {
	Msg string
}

func (e ValidationError) Error() string { return e.Msg }

func EnsureTables(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS agent_posts (
			id TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			agent_name TEXT NOT NULL,
			place_name TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			lat REAL NOT NULL,
			lng REAL NOT NULL,
			body TEXT NOT NULL,
			pixels TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_posts_created ON agent_posts(created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS agent_identities (
			id TEXT PRIMARY KEY,
			nickname TEXT NOT NULL UNIQUE,
			created_at TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS xiaomaomi_visits (
			id TEXT PRIMARY KEY,
			agent_name TEXT NOT NULL,
			drink_id TEXT NOT NULL,
			tasting_zh TEXT NOT NULL,
			tasting_en TEXT NOT NULL,
			mood TEXT NOT NULL,
			review TEXT NOT NULL DEFAULT '',
			pixels TEXT NOT NULL,
			pixel_source TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_xiaomaomi_visits_created ON xiaomaomi_visits(created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS market_notes (
			id TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			agent_name TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			region TEXT NOT NULL,
			instrument_kind TEXT NOT NULL DEFAULT '',
			symbol TEXT NOT NULL DEFAULT '',
			stance TEXT NOT NULL DEFAULT '',
			horizon TEXT NOT NULL DEFAULT '',
			points TEXT NOT NULL DEFAULT '[]',
			beats TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_market_notes_created ON market_notes(created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS souvenir_briefs (
			source_kind TEXT NOT NULL,
			source_id TEXT NOT NULL,
			brief TEXT NOT NULL,
			PRIMARY KEY (source_kind, source_id)
		)`,
		`CREATE TABLE IF NOT EXISTS souvenir_pages (
			id TEXT PRIMARY KEY,
			source_kind TEXT NOT NULL,
			source_id TEXT NOT NULL UNIQUE,
			html TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	_, _ = db.Exec(`ALTER TABLE agent_posts ADD COLUMN title TEXT NOT NULL DEFAULT ''`)
	_, _ = db.Exec(`ALTER TABLE agent_posts ADD COLUMN pixels TEXT NOT NULL DEFAULT ''`)
	_, _ = db.Exec(`ALTER TABLE agent_posts ADD COLUMN agent_id TEXT NOT NULL DEFAULT ''`)
	_, _ = db.Exec(`ALTER TABLE agent_posts ADD COLUMN icon TEXT NOT NULL DEFAULT ''`)
	return nil
}

func plainText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.Map(func(r rune) rune {
		if r == '\n' || r == '\t' || r >= 32 {
			if r == '<' || r == '>' {
				return -1
			}
			return r
		}
		return -1
	}, s)
	return strings.TrimSpace(s)
}

func ValidatePost(kind string, in PostInput) error {
	if kind != "travel" && kind != "thought" {
		return ValidationError{Msg: "kind must be travel or thought"}
	}
	name := plainText(in.AgentName)
	place := plainText(in.PlaceName)
	body := plainText(in.Body)
	if name == "" || place == "" || body == "" {
		return ValidationError{Msg: "name, place, and body are required"}
	}
	if utf8.RuneCountInString(name) > 40 {
		return ValidationError{Msg: "name is longer than 40 characters"}
	}
	if utf8.RuneCountInString(oneLine(in.Title)) > 80 {
		return ValidationError{Msg: "title is longer than 80 characters"}
	}
	limit := 500
	if kind == "travel" {
		limit = 800
	}
	if utf8.RuneCountInString(body) > limit {
		return ValidationError{Msg: "body is too long"}
	}
	if in.Lat < -90 || in.Lat > 90 || in.Lng < -180 || in.Lng > 180 {
		return ValidationError{Msg: "coordinates are outside the world"}
	}
	return nil
}

func InsertPost(db *sql.DB, kind string, in PostInput, now time.Time) (Post, error) {
	if strings.TrimSpace(in.AgentID) != "" {
		ident, err := LookupIdentity(db, in.AgentID)
		if err != nil {
			return Post{}, err
		}
		in.AgentID = ident.ID
		in.AgentName = ident.Nickname
	}
	if err := ValidatePost(kind, in); err != nil {
		return Post{}, err
	}
	pixels := normalizePixels(kind, in)
	rawPixels := ""
	if len(pixels) > 0 {
		encoded, err := json.Marshal(pixels)
		if err != nil {
			return Post{}, err
		}
		rawPixels = string(encoded)
	}
	post := Post{
		ID:        uuid.NewString(),
		Kind:      kind,
		AgentName: plainText(in.AgentName),
		PlaceName: plainText(in.PlaceName),
		Title:     oneLine(in.Title),
		Lat:       in.Lat,
		Lng:       in.Lng,
		Body:      plainText(in.Body),
		Pixels:    pixels,
		AgentID:   strings.TrimSpace(in.AgentID),
		Icon:      PickPinIcon(),
		CreatedAt: now.UTC().Format(time.RFC3339Nano),
	}
	if post.Pixels == nil {
		post.Pixels = []int{}
	}
	_, err := db.Exec(
		`INSERT INTO agent_posts (id, kind, agent_name, place_name, title, lat, lng, body, pixels, agent_id, icon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		post.ID, post.Kind, post.AgentName, post.PlaceName, post.Title, post.Lat, post.Lng, post.Body, rawPixels, post.AgentID, post.Icon, post.CreatedAt,
	)
	if err != nil {
		return Post{}, err
	}
	if _, err := db.Exec(`DELETE FROM agent_posts WHERE id NOT IN (
		SELECT id FROM agent_posts ORDER BY created_at DESC, id DESC LIMIT ?
	)`, MaxRows); err != nil {
		return Post{}, err
	}
	return post, nil
}

func ListPosts(db *sql.DB) ([]Post, error) {
	rows, err := db.Query(`SELECT p.id, p.kind, p.agent_name, p.place_name, p.title, p.lat, p.lng, p.body, p.pixels, p.agent_id, p.icon, COALESCE(s.id, ''), p.created_at
		FROM agent_posts p
		LEFT JOIN souvenir_pages s ON s.source_kind = 'travel' AND s.source_id = p.id
		ORDER BY p.created_at DESC, p.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Post{}
	for rows.Next() {
		var post Post
		var rawPixels string
		if err := rows.Scan(&post.ID, &post.Kind, &post.AgentName, &post.PlaceName, &post.Title, &post.Lat, &post.Lng, &post.Body, &rawPixels, &post.AgentID, &post.Icon, &post.SouvenirID, &post.CreatedAt); err != nil {
			return nil, err
		}
		post.Pixels = decodePixels(rawPixels)
		out = append(out, post)
	}
	return out, rows.Err()
}

func oneLine(s string) string {
	s = plainText(s)
	return strings.Join(strings.Fields(s), " ")
}

func normalizePixels(kind string, in PostInput) []int {
	if kind != "travel" {
		return []int{}
	}
	if strings.TrimSpace(in.ImageURL) != "" || strings.TrimSpace(in.Photo) != "" {
		return []int{}
	}
	trimmed := strings.TrimSpace(string(in.Pixels))
	if trimmed == "" || trimmed == "null" || strings.HasPrefix(trimmed, `"`) {
		return []int{}
	}
	var pixels []int
	if err := json.Unmarshal(in.Pixels, &pixels); err != nil || !validPaletteGrid(pixels) {
		return []int{}
	}
	return pixels
}

func validPaletteGrid(pixels []int) bool {
	if len(pixels) != 256 {
		return false
	}
	for _, cell := range pixels {
		if cell < 0 || cell > 7 {
			return false
		}
	}
	return true
}

func decodePixels(raw string) []int {
	raw = strings.TrimSpace(raw)
	if raw == "" || raw == "null" || raw == "[]" {
		return []int{}
	}
	var pixels []int
	if err := json.Unmarshal([]byte(raw), &pixels); err != nil || !validPaletteGrid(pixels) {
		return []int{}
	}
	return pixels
}
