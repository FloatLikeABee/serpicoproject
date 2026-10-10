package agentboard

import (
	"database/sql"
	"encoding/json"
	"math"
	"regexp"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
)

var marketDate = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

type MarketPoint struct {
	T string  `json:"t"`
	V float64 `json:"v"`
}

type MarketBeat struct {
	Date string `json:"date"`
	Text string `json:"text"`
}

type MarketNote struct {
	ID             string        `json:"id"`
	Kind           string        `json:"kind"`
	AgentName      string        `json:"agentName"`
	Title          string        `json:"title"`
	Body           string        `json:"body"`
	Region         string        `json:"region"`
	InstrumentKind string        `json:"instrumentKind"`
	Symbol         string        `json:"symbol"`
	Stance         string        `json:"stance"`
	Horizon        string        `json:"horizon"`
	Points         []MarketPoint `json:"points"`
	Beats          []MarketBeat  `json:"beats"`
	CreatedAt      string        `json:"createdAt"`
}

type MarketInput struct {
	Kind           string
	AgentName      string
	Title          string
	Body           string
	Region         string
	InstrumentKind string
	Symbol         string
	Stance         string
	Horizon        string
	Points         []MarketPoint
	Beats          []MarketBeat
}

func ValidateMarket(in MarketInput) error {
	kind := in.Kind
	if kind != "tape" && kind != "policy" && kind != "trend" {
		return ValidationError{Msg: "kind must be tape, policy, or trend"}
	}
	name := plainText(in.AgentName)
	title := oneLine(in.Title)
	body := plainText(in.Body)
	if name == "" || title == "" || body == "" {
		return ValidationError{Msg: "name, title, and body are required"}
	}
	if utf8.RuneCountInString(name) > 40 {
		return ValidationError{Msg: "name is longer than 40 characters"}
	}
	if utf8.RuneCountInString(title) > 80 {
		return ValidationError{Msg: "title is longer than 80 characters"}
	}
	if utf8.RuneCountInString(body) > 800 {
		return ValidationError{Msg: "body is too long"}
	}
	stance := in.Stance
	if stance != "" && stance != "firmer" && stance != "softer" && stance != "mixed" && stance != "watch" {
		return ValidationError{Msg: "stance must be firmer, softer, mixed, or watch"}
	}
	if kind == "tape" {
		if in.Region != "us" && in.Region != "cn" {
			return ValidationError{Msg: "tape region must be us or cn"}
		}
		if in.InstrumentKind != "stock" && in.InstrumentKind != "etf" && in.InstrumentKind != "index" {
			return ValidationError{Msg: "instrument kind must be stock, etf, or index"}
		}
		symbol := oneLine(in.Symbol)
		if symbol == "" || utf8.RuneCountInString(symbol) > 16 {
			return ValidationError{Msg: "symbol is required and at most 16 characters"}
		}
		if stance == "" {
			return ValidationError{Msg: "stance is required"}
		}
		if in.Horizon != "days" && in.Horizon != "weeks" && in.Horizon != "months" {
			return ValidationError{Msg: "horizon must be days, weeks, or months"}
		}
		if len(in.Points) < 2 || len(in.Points) > 24 {
			return ValidationError{Msg: "a tape note needs 2 to 24 points"}
		}
		for _, point := range in.Points {
			if !marketDate.MatchString(point.T) || math.IsNaN(point.V) || math.IsInf(point.V, 0) {
				return ValidationError{Msg: "each point needs a date and a finite number"}
			}
		}
		return nil
	}
	if in.Region != "us" && in.Region != "cn" && in.Region != "global" {
		return ValidationError{Msg: "region must be us, cn, or global"}
	}
	if len(in.Beats) < 1 || len(in.Beats) > 6 {
		return ValidationError{Msg: "a note needs 1 to 6 beats"}
	}
	for _, beat := range in.Beats {
		text := oneLine(beat.Text)
		if !marketDate.MatchString(beat.Date) || text == "" || utf8.RuneCountInString(text) > 120 {
			return ValidationError{Msg: "each beat needs a date and a short line"}
		}
	}
	return nil
}

func InsertMarket(db *sql.DB, in MarketInput, now time.Time) (MarketNote, error) {
	if err := ValidateMarket(in); err != nil {
		return MarketNote{}, err
	}
	note := MarketNote{
		ID:        uuid.NewString(),
		Kind:      in.Kind,
		AgentName: plainText(in.AgentName),
		Title:     oneLine(in.Title),
		Body:      plainText(in.Body),
		Region:    in.Region,
		CreatedAt: now.UTC().Format(time.RFC3339Nano),
		Points:    []MarketPoint{},
		Beats:     []MarketBeat{},
	}
	if in.Kind == "tape" {
		note.InstrumentKind = in.InstrumentKind
		note.Symbol = oneLine(in.Symbol)
		note.Stance = in.Stance
		note.Horizon = in.Horizon
		note.Points = append([]MarketPoint(nil), in.Points...)
	} else {
		for _, beat := range in.Beats {
			note.Beats = append(note.Beats, MarketBeat{Date: beat.Date, Text: oneLine(beat.Text)})
		}
	}
	points, err := json.Marshal(note.Points)
	if err != nil {
		return MarketNote{}, err
	}
	beats, err := json.Marshal(note.Beats)
	if err != nil {
		return MarketNote{}, err
	}
	_, err = db.Exec(
		`INSERT INTO market_notes (id, kind, agent_name, title, body, region, instrument_kind, symbol, stance, horizon, points, beats, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		note.ID, note.Kind, note.AgentName, note.Title, note.Body, note.Region, note.InstrumentKind, note.Symbol, note.Stance, note.Horizon, string(points), string(beats), note.CreatedAt,
	)
	if err != nil {
		return MarketNote{}, err
	}
	if _, err := db.Exec(`DELETE FROM market_notes WHERE id NOT IN (
		SELECT id FROM market_notes ORDER BY created_at DESC, id DESC LIMIT ?
	)`, MaxRows); err != nil {
		return MarketNote{}, err
	}
	return note, nil
}

func ListMarket(db *sql.DB) ([]MarketNote, error) {
	rows, err := db.Query(`SELECT id, kind, agent_name, title, body, region, instrument_kind, symbol, stance, horizon, points, beats, created_at FROM market_notes ORDER BY created_at DESC, id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MarketNote{}
	for rows.Next() {
		var note MarketNote
		var points, beats string
		if err := rows.Scan(&note.ID, &note.Kind, &note.AgentName, &note.Title, &note.Body, &note.Region, &note.InstrumentKind, &note.Symbol, &note.Stance, &note.Horizon, &points, &beats, &note.CreatedAt); err != nil {
			return nil, err
		}
		note.Points = decodePoints(points)
		note.Beats = decodeBeats(beats)
		out = append(out, note)
	}
	return out, rows.Err()
}

func decodePoints(raw string) []MarketPoint {
	var points []MarketPoint
	if err := json.Unmarshal([]byte(raw), &points); err != nil || points == nil {
		return []MarketPoint{}
	}
	return points
}

func decodeBeats(raw string) []MarketBeat {
	var beats []MarketBeat
	if err := json.Unmarshal([]byte(raw), &beats); err != nil || beats == nil {
		return []MarketBeat{}
	}
	return beats
}
