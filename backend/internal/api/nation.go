package api

import (
	"database/sql"
	"strings"

	"github.com/gin-gonic/gin"
)

// ParseNation maps request/storage values to us | cn. Unknown values become us.
func ParseNation(raw string) string {
	v := strings.ToLower(strings.TrimSpace(raw))
	switch v {
	case "cn", "china", "zh", "zh-cn", "zh_cn", "zh-hans":
		return "cn"
	default:
		return "us"
	}
}

// ReplyLanguageInstruction is appended to model prompts for the account nation.
func ReplyLanguageInstruction(nation string) string {
	if ParseNation(nation) == "cn" {
		return "请用简体中文回复。所有产品文案与情报摘要必须使用简体中文。"
	}
	return "Reply in English."
}

func helperNation(c *gin.Context) string {
	if c == nil {
		return "us"
	}
	if n := strings.TrimSpace(c.Query("nation")); n != "" {
		return ParseNation(n)
	}
	return "us"
}

// GetUserNation returns the stored nation for userID, defaulting to us.
func GetUserNation(db *sql.DB, userID string) (string, error) {
	if db == nil {
		return "us", nil
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return "us", nil
	}
	var nation sql.NullString
	err := db.QueryRow(`SELECT COALESCE(nation, 'us') FROM users WHERE id = ?`, userID).Scan(&nation)
	if err == sql.ErrNoRows {
		return "us", nil
	}
	if err != nil {
		return "us", err
	}
	return ParseNation(nation.String), nil
}

// UpsertUserNation writes nation on the users row (CORS-safe helper upsert).
func UpsertUserNation(db *sql.DB, userID, nation string) error {
	if db == nil {
		return nil
	}
	userID = strings.TrimSpace(userID)
	if userID == "" {
		userID = "guest"
	}
	n := ParseNation(nation)
	email := userID + "@serpico.local"
	if userID == "demo-serpico" {
		email = "serpico"
	}
	_, err := db.Exec(`
		INSERT INTO users (id, email, name, role, rank, nation)
		VALUES (?, ?, ?, 'police', 'Officer', ?)
		ON CONFLICT(id) DO UPDATE SET nation = excluded.nation`,
		userID, email, userID, n,
	)
	if err != nil {
		// email UNIQUE may collide on demo seed — update by id only.
		_, err2 := db.Exec(`UPDATE users SET nation = ? WHERE id = ?`, n, userID)
		if err2 != nil {
			return err
		}
		var count int
		_ = db.QueryRow(`SELECT COUNT(*) FROM users WHERE id = ?`, userID).Scan(&count)
		if count == 0 {
			return err
		}
	}
	return nil
}
