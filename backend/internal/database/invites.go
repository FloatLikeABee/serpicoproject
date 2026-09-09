package database

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const crockford = "0123456789abcdefghjkmnpqrstvwxyz"
const passwordAlphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func randomFromAlphabet(alphabet string, n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, n)
	for i := 0; i < n; i++ {
		out[i] = alphabet[int(buf[i])%len(alphabet)]
	}
	return string(out), nil
}

// GenerateInviteCode returns 32 bytes of crypto/rand as hex (64 chars).
func GenerateInviteCode() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw), nil
}

// GenerateInviteUsername returns "off" plus 10 Crockford characters, never "serpico".
func GenerateInviteUsername() (string, error) {
	for i := 0; i < 8; i++ {
		suffix, err := randomFromAlphabet(crockford, 10)
		if err != nil {
			return "", err
		}
		name := "off" + suffix
		if name != "serpico" {
			return name, nil
		}
	}
	return "", fmt.Errorf("could not generate username")
}

// GenerateInvitePassword returns a 16-character password from a no-ambiguous charset.
func GenerateInvitePassword() (string, error) {
	return randomFromAlphabet(passwordAlphabet, 16)
}

// InviteRecord is one minted invitation with recoverable credentials.
type InviteRecord struct {
	ID        string `json:"id"`
	Code      string `json:"code"`
	UserID    string `json:"userId"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	Note      string `json:"note,omitempty"`
	CreatedAt string `json:"createdAt,omitempty"`
}

// CreateInvite mints a unique code and username/password, stores bcrypt on users.
func CreateInvite(db *sql.DB, note string) (*InviteRecord, error) {
	note = strings.TrimSpace(note)
	var lastErr error
	for attempt := 0; attempt < 8; attempt++ {
		code, err := GenerateInviteCode()
		if err != nil {
			return nil, err
		}
		username, err := GenerateInviteUsername()
		if err != nil {
			return nil, err
		}
		password, err := GenerateInvitePassword()
		if err != nil {
			return nil, err
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		userID := uuid.New().String()
		inviteID := uuid.New().String()
		name := "Officer " + username

		tx, err := db.Begin()
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(
			`INSERT INTO users (id, email, name, role, rank, nation, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			userID, username, name, "police", "Officer", "us", string(hash),
		); err != nil {
			_ = tx.Rollback()
			lastErr = err
			continue
		}
		if _, err := tx.Exec(
			`INSERT INTO invites (id, code, user_id, username, password_plain, note) VALUES (?, ?, ?, ?, ?, ?)`,
			inviteID, code, userID, username, password, note,
		); err != nil {
			_ = tx.Rollback()
			lastErr = err
			continue
		}
		if err := tx.Commit(); err != nil {
			lastErr = err
			continue
		}
		return &InviteRecord{
			ID:       inviteID,
			Code:     code,
			UserID:   userID,
			Username: username,
			Password: password,
			Note:     note,
		}, nil
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, fmt.Errorf("could not create unique invite")
}

// ListInvites returns all invitations, newest first.
func ListInvites(db *sql.DB) ([]InviteRecord, error) {
	rows, err := db.Query(
		`SELECT id, code, user_id, username, password_plain, COALESCE(note,''), created_at
		 FROM invites ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []InviteRecord{}
	for rows.Next() {
		var rec InviteRecord
		if err := rows.Scan(&rec.ID, &rec.Code, &rec.UserID, &rec.Username, &rec.Password, &rec.Note, &rec.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

// GetInviteByCode returns the invite for an exact code match.
func GetInviteByCode(db *sql.DB, code string) (*InviteRecord, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, sql.ErrNoRows
	}
	var rec InviteRecord
	err := db.QueryRow(
		`SELECT id, code, user_id, username, password_plain, COALESCE(note,''), created_at
		 FROM invites WHERE code = ?`,
		code,
	).Scan(&rec.ID, &rec.Code, &rec.UserID, &rec.Username, &rec.Password, &rec.Note, &rec.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}
