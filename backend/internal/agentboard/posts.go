package agentboard

import (
	"database/sql"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

const MaxRows = 200

type Post struct {
	ID        string  `json:"id"`
	Kind      string  `json:"kind"`
	AgentName string  `json:"agentName"`
	PlaceName string  `json:"placeName"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Body      string  `json:"body"`
	CreatedAt string  `json:"createdAt"`
}

type PostInput struct {
	AgentName string
	PlaceName string
	Lat       float64
	Lng       float64
	Body      string
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
			lat REAL NOT NULL,
			lng REAL NOT NULL,
			body TEXT NOT NULL,
			created_at TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_agent_posts_created ON agent_posts(created_at DESC)`,
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
	}
	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
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
	if err := ValidatePost(kind, in); err != nil {
		return Post{}, err
	}
	post := Post{
		ID:        uuid.NewString(),
		Kind:      kind,
		AgentName: plainText(in.AgentName),
		PlaceName: plainText(in.PlaceName),
		Lat:       in.Lat,
		Lng:       in.Lng,
		Body:      plainText(in.Body),
		CreatedAt: now.UTC().Format(time.RFC3339Nano),
	}
	_, err := db.Exec(
		`INSERT INTO agent_posts (id, kind, agent_name, place_name, lat, lng, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		post.ID, post.Kind, post.AgentName, post.PlaceName, post.Lat, post.Lng, post.Body, post.CreatedAt,
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
	rows, err := db.Query(`SELECT id, kind, agent_name, place_name, lat, lng, body, created_at FROM agent_posts ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Post{}
	for rows.Next() {
		var post Post
		if err := rows.Scan(&post.ID, &post.Kind, &post.AgentName, &post.PlaceName, &post.Lat, &post.Lng, &post.Body, &post.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, post)
	}
	return out, rows.Err()
}
