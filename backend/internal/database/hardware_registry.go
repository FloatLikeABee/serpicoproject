package database

import (
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

const HardwareTopicPrefix = "serpico/hard-data/hw/"

var (
	ErrHardwareSerialEmpty   = fmt.Errorf("serial is required")
	ErrHardwareSerialInvalid = fmt.Errorf("serial must be letters, numbers, dot, underscore, or hyphen")
	ErrHardwareNotFound      = fmt.Errorf("hardware not found")
	hardwareSerialPattern    = regexp.MustCompile(`^[A-Z0-9._-]+$`)
)

// HardwareDevice is a registered serial bound to an MQTT topic.
type HardwareDevice struct {
	ID        string `json:"id"`
	Serial    string `json:"serial"`
	Topic     string `json:"topic"`
	CreatedAt string `json:"createdAt"`
}

// NormalizeHardwareSerial trims, uppercases, and validates a serial.
func NormalizeHardwareSerial(raw string) (string, error) {
	s := strings.ToUpper(strings.TrimSpace(raw))
	if s == "" {
		return "", ErrHardwareSerialEmpty
	}
	if !hardwareSerialPattern.MatchString(s) {
		return "", ErrHardwareSerialInvalid
	}
	return s, nil
}

// HardwareTopic returns the MQTT topic for a normalized serial.
func HardwareTopic(serial string) string {
	return HardwareTopicPrefix + serial
}

// RegisterHardware inserts a device or returns the existing row for that serial.
func RegisterHardware(db *sql.DB, rawSerial string) (HardwareDevice, bool, error) {
	if db == nil {
		return HardwareDevice{}, false, fmt.Errorf("database is nil")
	}
	serial, err := NormalizeHardwareSerial(rawSerial)
	if err != nil {
		return HardwareDevice{}, false, err
	}
	if existing, ok, err := getHardwareBySerial(db, serial); err != nil {
		return HardwareDevice{}, false, err
	} else if ok {
		return existing, false, nil
	}

	rec := HardwareDevice{
		ID:        uuid.New().String(),
		Serial:    serial,
		Topic:     HardwareTopic(serial),
		CreatedAt: time.Now().UTC().Format(time.RFC3339Nano),
	}
	_, err = db.Exec(
		`INSERT INTO hardware_registry (id, serial, topic, created_at) VALUES (?, ?, ?, ?)`,
		rec.ID, rec.Serial, rec.Topic, rec.CreatedAt,
	)
	if err != nil {
		if existing, ok, getErr := getHardwareBySerial(db, serial); getErr == nil && ok {
			return existing, false, nil
		}
		return HardwareDevice{}, false, err
	}
	return rec, true, nil
}

func getHardwareBySerial(db *sql.DB, serial string) (HardwareDevice, bool, error) {
	var rec HardwareDevice
	err := db.QueryRow(
		`SELECT id, serial, topic, created_at FROM hardware_registry WHERE serial = ?`,
		serial,
	).Scan(&rec.ID, &rec.Serial, &rec.Topic, &rec.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return HardwareDevice{}, false, nil
	}
	if err != nil {
		return HardwareDevice{}, false, err
	}
	return rec, true, nil
}

// GetHardware returns a device by id.
func GetHardware(db *sql.DB, id string) (HardwareDevice, error) {
	if db == nil {
		return HardwareDevice{}, fmt.Errorf("database is nil")
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return HardwareDevice{}, ErrHardwareNotFound
	}
	var rec HardwareDevice
	err := db.QueryRow(
		`SELECT id, serial, topic, created_at FROM hardware_registry WHERE id = ?`,
		id,
	).Scan(&rec.ID, &rec.Serial, &rec.Topic, &rec.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return HardwareDevice{}, ErrHardwareNotFound
	}
	return rec, err
}

// ListHardware returns devices newest first.
func ListHardware(db *sql.DB) ([]HardwareDevice, error) {
	if db == nil {
		return nil, fmt.Errorf("database is nil")
	}
	rows, err := db.Query(
		`SELECT id, serial, topic, created_at FROM hardware_registry ORDER BY created_at DESC, id DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []HardwareDevice{}
	for rows.Next() {
		var rec HardwareDevice
		if err := rows.Scan(&rec.ID, &rec.Serial, &rec.Topic, &rec.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, rec)
	}
	return out, rows.Err()
}
