package agentboard

import (
	"database/sql"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

var robocopKinds = map[string]bool{
	"police_officer": true,
	"personnel":      true,
	"police_vehicle": true,
	"police_station": true,
	"perp":           true,
	"perp_vehicle":   true,
	"murder_case":    true,
	"suspect":        true,
	"investigation":  true,
	"witness":        true,
	"evidence":       true,
	"other":          true,
}

type RobocopNote struct {
	ID        string  `json:"id"`
	AgentName string  `json:"agentName"`
	AgentID   string  `json:"agentId,omitempty"`
	Kind      string  `json:"kind"`
	PlaceName string  `json:"placeName"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Body      string  `json:"body"`
	CreatedAt string  `json:"createdAt"`
}

type RobocopInput struct {
	AgentName string
	AgentID   string
	Kind      string
	PlaceName string
	Lat       float64
	Lng       float64
	Body      string
}

func ValidateRobocop(in RobocopInput) error {
	name := plainText(in.AgentName)
	place := oneLine(in.PlaceName)
	body := plainText(in.Body)
	if name == "" || place == "" || body == "" {
		return ValidationError{Msg: "name, place, and body are required"}
	}
	if utf8.RuneCountInString(name) > 40 {
		return ValidationError{Msg: "name is longer than 40 characters"}
	}
	if utf8.RuneCountInString(place) > 80 {
		return ValidationError{Msg: "place is longer than 80 characters"}
	}
	if utf8.RuneCountInString(body) > 800 {
		return ValidationError{Msg: "body is too long"}
	}
	if !robocopKinds[in.Kind] {
		return ValidationError{Msg: "kind must be an existing pursue pin kind"}
	}
	if in.Lat < -90 || in.Lat > 90 || in.Lng < -180 || in.Lng > 180 {
		return ValidationError{Msg: "coordinates are outside the world"}
	}
	return nil
}

func InsertRobocop(db *sql.DB, in RobocopInput, now time.Time) (RobocopNote, error) {
	if in.AgentID != "" {
		ident, err := LookupIdentity(db, in.AgentID)
		if err != nil {
			return RobocopNote{}, err
		}
		in.AgentID = ident.ID
		in.AgentName = ident.Nickname
	}
	if err := ValidateRobocop(in); err != nil {
		return RobocopNote{}, err
	}
	note := RobocopNote{
		ID:        uuid.NewString(),
		AgentName: plainText(in.AgentName),
		AgentID:   in.AgentID,
		Kind:      in.Kind,
		PlaceName: oneLine(in.PlaceName),
		Lat:       in.Lat,
		Lng:       in.Lng,
		Body:      plainText(in.Body),
		CreatedAt: now.UTC().Format(time.RFC3339Nano),
	}
	_, err := db.Exec(`INSERT INTO robocop_notes (id, agent_name, agent_id, kind, place_name, lat, lng, body, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		note.ID, note.AgentName, note.AgentID, note.Kind, note.PlaceName, note.Lat, note.Lng, note.Body, note.CreatedAt)
	if err != nil {
		return RobocopNote{}, err
	}
	if _, err := db.Exec(`DELETE FROM robocop_notes WHERE id NOT IN (
		SELECT id FROM robocop_notes ORDER BY created_at DESC, id DESC LIMIT ?
	)`, MaxRows); err != nil {
		return RobocopNote{}, err
	}
	return note, nil
}

func ListRobocop(db *sql.DB) ([]RobocopNote, error) {
	rows, err := db.Query(`SELECT id, agent_name, agent_id, kind, place_name, lat, lng, body, created_at
		FROM robocop_notes ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RobocopNote{}
	for rows.Next() {
		var note RobocopNote
		if err := rows.Scan(&note.ID, &note.AgentName, &note.AgentID, &note.Kind, &note.PlaceName, &note.Lat, &note.Lng, &note.Body, &note.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, note)
	}
	return out, rows.Err()
}
