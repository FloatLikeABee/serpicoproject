package database

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	HardDataMaxPayload  = 32 * 1024
	HardDataDefaultLimit = 50
	HardDataSourceHTTP  = "http"
	HardDataSourceMQTT  = "mqtt"
	HardDataHTTPTopic   = "serpico/hard-data/http"
)

var (
	ErrHardDataEmpty    = fmt.Errorf("payload is required")
	ErrHardDataTooLarge = fmt.Errorf("payload exceeds 32 KiB")
	ErrHardDataSource   = fmt.Errorf("source must be http or mqtt")
)

// HardDataRecord is one ingested fact stored as received.
type HardDataRecord struct {
	ID         string `json:"id"`
	Topic      string `json:"topic"`
	Payload    string `json:"payload"`
	Source     string `json:"source"`
	ReceivedAt string `json:"receivedAt"`
}

// OpenSQLite opens a SQLite file (or :memory:) and ensures schema exists.
// Tests and helpers can skip Badger. Production still uses Initialize().
func OpenSQLite(dsn string) (*Database, error) {
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	if err := createTables(db); err != nil {
		_ = db.Close()
		return nil, err
	}
	return &Database{SQLite: db}, nil
}

// InsertHardData appends one hard-data row. Payload is stored as-is.
func InsertHardData(db *sql.DB, topic, payload, source string) (HardDataRecord, error) {
	if db == nil {
		return HardDataRecord{}, fmt.Errorf("database is nil")
	}
	if len(payload) > HardDataMaxPayload {
		return HardDataRecord{}, ErrHardDataTooLarge
	}
	if payload == "" {
		return HardDataRecord{}, ErrHardDataEmpty
	}
	src := strings.ToLower(strings.TrimSpace(source))
	if src != HardDataSourceHTTP && src != HardDataSourceMQTT {
		return HardDataRecord{}, ErrHardDataSource
	}
	topic = strings.TrimSpace(topic)
	if topic == "" {
		if src == HardDataSourceHTTP {
			topic = HardDataHTTPTopic
		} else {
			topic = "serpico/hard-data"
		}
	}
	rec := HardDataRecord{
		ID:         uuid.New().String(),
		Topic:      topic,
		Payload:    payload,
		Source:     src,
		ReceivedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	_, err := db.Exec(
		`INSERT INTO hard_data (id, topic, payload, source, received_at) VALUES (?, ?, ?, ?, ?)`,
		rec.ID, rec.Topic, rec.Payload, rec.Source, rec.ReceivedAt,
	)
	if err != nil {
		return HardDataRecord{}, err
	}
	return rec, nil
}

// ListHardData returns newest-first records, capped at HardDataDefaultLimit.
func ListHardData(db *sql.DB, limit int) ([]HardDataRecord, error) {
	if db == nil {
		return nil, fmt.Errorf("database is nil")
	}
	if limit <= 0 || limit > HardDataDefaultLimit {
		limit = HardDataDefaultLimit
	}
	rows, err := db.Query(
		`SELECT id, topic, payload, source, received_at FROM hard_data ORDER BY received_at DESC, id DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []HardDataRecord{}
	for rows.Next() {
		var rec HardDataRecord
		if err := rows.Scan(&rec.ID, &rec.Topic, &rec.Payload, &rec.Source, &rec.ReceivedAt); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}

// ListHardDataByTopic returns newest-first records for one MQTT/HTTP topic.
func ListHardDataByTopic(db *sql.DB, topic string, limit int) ([]HardDataRecord, error) {
	if db == nil {
		return nil, fmt.Errorf("database is nil")
	}
	topic = strings.TrimSpace(topic)
	if topic == "" {
		return []HardDataRecord{}, nil
	}
	if limit <= 0 || limit > HardDataDefaultLimit {
		limit = HardDataDefaultLimit
	}
	rows, err := db.Query(
		`SELECT id, topic, payload, source, received_at FROM hard_data WHERE topic = ? ORDER BY received_at DESC, id DESC LIMIT ?`,
		topic, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []HardDataRecord{}
	for rows.Next() {
		var rec HardDataRecord
		if err := rows.Scan(&rec.ID, &rec.Topic, &rec.Payload, &rec.Source, &rec.ReceivedAt); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}
