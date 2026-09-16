package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// LalemTrendRow is one persisted 热榜 card.
type LalemTrendRow struct {
	ID        string
	Locale    string
	Kind      string
	Title     string
	Hook      string
	ImageURL  string
	Chips     []string
	CreatedAt time.Time
}

// LalemUsefulRow is one persisted 有用 note.
type LalemUsefulRow struct {
	ID        string
	Locale    string
	Body      string
	CreatedAt time.Time
}

func shanghaiLoc() *time.Location {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return time.FixedZone("CST", 8*3600)
	}
	return loc
}

func normalizeLalemLocale(locale string) string {
	v := strings.ToLower(strings.TrimSpace(locale))
	if v == "cn" || v == "zh" || v == "zh-cn" {
		return "cn"
	}
	if v == "en" || v == "us" {
		return "en"
	}
	if v == "" {
		return "cn"
	}
	return v
}

func lalemStamp(t time.Time) string {
	if t.IsZero() {
		t = time.Now().UTC()
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func parseLalemStamp(raw string) time.Time {
	s := strings.TrimSpace(raw)
	if s == "" {
		return time.Time{}
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02 15:04:05", s); err == nil {
		return t.UTC()
	}
	return time.Time{}
}

// InsertLalemTrend stores a trend card. Duplicate (locale, title) is ignored.
func InsertLalemTrend(db *sql.DB, row LalemTrendRow) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}
	row.Locale = normalizeLalemLocale(row.Locale)
	row.Title = strings.TrimSpace(row.Title)
	if row.Title == "" {
		return fmt.Errorf("trend title is required")
	}
	if row.ID == "" {
		row.ID = uuid.New().String()
	}
	chips, err := json.Marshal(row.Chips)
	if err != nil {
		return err
	}
	if row.Chips == nil {
		chips = []byte("[]")
	}
	_, err = db.Exec(
		`INSERT OR IGNORE INTO lalem_trends (id, locale, kind, title, hook, image_url, chips_json, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		row.ID, row.Locale, strings.TrimSpace(row.Kind), row.Title, row.Hook, row.ImageURL, string(chips), lalemStamp(row.CreatedAt),
	)
	return err
}

// InsertLalemUseful stores a useful note. Duplicate (locale, body) is ignored.
func InsertLalemUseful(db *sql.DB, row LalemUsefulRow) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}
	row.Locale = normalizeLalemLocale(row.Locale)
	row.Body = strings.TrimSpace(row.Body)
	if row.Body == "" {
		return fmt.Errorf("useful body is required")
	}
	if row.ID == "" {
		row.ID = uuid.New().String()
	}
	_, err := db.Exec(
		`INSERT OR IGNORE INTO lalem_useful (id, locale, body, created_at) VALUES (?, ?, ?, ?)`,
		row.ID, row.Locale, row.Body, lalemStamp(row.CreatedAt),
	)
	return err
}

// ListLalemTrends returns newest-first trend cards for a locale.
func ListLalemTrends(db *sql.DB, locale string) ([]LalemTrendRow, error) {
	if db == nil {
		return nil, fmt.Errorf("database is nil")
	}
	locale = normalizeLalemLocale(locale)
	rows, err := db.Query(
		`SELECT id, locale, kind, title, hook, image_url, chips_json, created_at
		 FROM lalem_trends WHERE locale = ? ORDER BY created_at DESC, title ASC`,
		locale,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]LalemTrendRow, 0)
	for rows.Next() {
		var row LalemTrendRow
		var chips string
		var created string
		if err := rows.Scan(&row.ID, &row.Locale, &row.Kind, &row.Title, &row.Hook, &row.ImageURL, &chips, &created); err != nil {
			return nil, err
		}
		row.CreatedAt = parseLalemStamp(created)
		if strings.TrimSpace(chips) != "" && chips != "null" {
			_ = json.Unmarshal([]byte(chips), &row.Chips)
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

// ListLalemUseful returns newest-first useful notes for a locale.
func ListLalemUseful(db *sql.DB, locale string) ([]LalemUsefulRow, error) {
	if db == nil {
		return nil, fmt.Errorf("database is nil")
	}
	locale = normalizeLalemLocale(locale)
	rows, err := db.Query(
		`SELECT id, locale, body, created_at FROM lalem_useful WHERE locale = ? ORDER BY created_at DESC, body ASC`,
		locale,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]LalemUsefulRow, 0)
	for rows.Next() {
		var row LalemUsefulRow
		var created string
		if err := rows.Scan(&row.ID, &row.Locale, &row.Body, &created); err != nil {
			return nil, err
		}
		row.CreatedAt = parseLalemStamp(created)
		out = append(out, row)
	}
	return out, rows.Err()
}

// PruneLalemFeed deletes trend and useful rows older than 3 calendar months in Asia/Shanghai.
func PruneLalemFeed(db *sql.DB, now time.Time) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}
	if now.IsZero() {
		now = time.Now()
	}
	cutoff := now.In(shanghaiLoc()).AddDate(0, -3, 0).UTC()
	stamp := lalemStamp(cutoff)
	if _, err := db.Exec(`DELETE FROM lalem_trends WHERE created_at < ?`, stamp); err != nil {
		return err
	}
	if _, err := db.Exec(`DELETE FROM lalem_useful WHERE created_at < ?`, stamp); err != nil {
		return err
	}
	return nil
}

// LalemShanghaiToday returns YYYY-MM-DD in Asia/Shanghai.
func LalemShanghaiToday(now time.Time) string {
	if now.IsZero() {
		now = time.Now()
	}
	return now.In(shanghaiLoc()).Format("2006-01-02")
}

// GetLalemFeedMeta returns last_increment_date for a locale.
func GetLalemFeedMeta(db *sql.DB, locale string) (date string, generatedAt string, ok bool, err error) {
	if db == nil {
		return "", "", false, fmt.Errorf("database is nil")
	}
	locale = normalizeLalemLocale(locale)
	var d, g sql.NullString
	err = db.QueryRow(
		`SELECT last_increment_date, last_generated_at FROM lalem_feed_meta WHERE locale = ?`,
		locale,
	).Scan(&d, &g)
	if err == sql.ErrNoRows {
		return "", "", false, nil
	}
	if err != nil {
		return "", "", false, err
	}
	return d.String, g.String, true, nil
}

// SetLalemFeedMeta upserts the last increment date for a locale.
func SetLalemFeedMeta(db *sql.DB, locale, date, generatedAt string) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}
	locale = normalizeLalemLocale(locale)
	if date == "" {
		date = LalemShanghaiToday(time.Now())
	}
	_, err := db.Exec(
		`INSERT INTO lalem_feed_meta (locale, last_increment_date, last_generated_at)
		 VALUES (?, ?, ?)
		 ON CONFLICT(locale) DO UPDATE SET last_increment_date = excluded.last_increment_date,
		   last_generated_at = excluded.last_generated_at`,
		locale, date, generatedAt,
	)
	return err
}
