package database

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
	"github.com/dgraph-io/badger/v3"
)

type Database struct {
	SQLite *sql.DB
	Cache  *badger.DB
}

func Initialize() (*Database, error) {
	// Prefer DATA_DIR (Render persistent disk). Fall back to ./data for local dev.
	dataDir := os.Getenv("DATA_DIR")
	if dataDir == "" {
		dataDir = "data"
	}
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	// Initialize SQLite on durable path
	sqlitePath := filepath.Join(dataDir, "serpico.db")
	log.Printf("Opening SQLite at %s", sqlitePath)
	db, err := sql.Open("sqlite3", sqlitePath+"?_busy_timeout=5000&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}
	// Keep a small pool — SQLite is file-backed.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Create tables
	if err := createTables(db); err != nil {
		return nil, err
	}

	// Drop demo investigation cases so the Cases desk starts empty for user-created work.
	if err := clearExampleCases(db); err != nil {
		log.Printf("Warning: Failed to clear example cases: %v", err)
	}

	// Seed database with mock data
	if err := SeedDatabase(db); err != nil {
		log.Printf("Warning: Failed to seed database: %v", err)
	}

	// Initialize BadgerDB for caching (same durable root)
	badgerPath := filepath.Join(dataDir, "cache")
	badgerDB, err := badger.Open(badger.DefaultOptions(badgerPath).WithLogger(nil))
	if err != nil {
		return nil, err
	}

	log.Println("Database initialized successfully")

	return &Database{
		SQLite: db,
		Cache:  badgerDB,
	}, nil
}

func (d *Database) Close() error {
	if d.SQLite != nil {
		if err := d.SQLite.Close(); err != nil {
			return err
		}
	}
	if d.Cache != nil {
		if err := d.Cache.Close(); err != nil {
			return err
		}
	}
	return nil
}

func createTables(db *sql.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT UNIQUE NOT NULL,
			name TEXT NOT NULL,
			role TEXT NOT NULL,
			rank TEXT,
			nation TEXT DEFAULT 'us',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS cases (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			location TEXT NOT NULL,
			date TEXT NOT NULL,
			status TEXT NOT NULL,
			description TEXT,
			solved INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS perps (
			id TEXT PRIMARY KEY,
			alias TEXT NOT NULL,
			location TEXT,
			last_seen TEXT,
			status TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS officers (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			rank TEXT NOT NULL,
			vehicle_plate TEXT,
			vehicle_number TEXT,
			current_location TEXT,
			status TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS emergencies (
			id TEXT PRIMARY KEY,
			type TEXT NOT NULL,
			location TEXT NOT NULL,
			priority TEXT NOT NULL,
			category TEXT NOT NULL,
			assigned_officer_id TEXT,
			status TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS mysteries (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			category TEXT NOT NULL,
			location TEXT NOT NULL,
			date TEXT NOT NULL,
			description TEXT,
			credibility TEXT,
			source TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS mystery_cases (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			category TEXT NOT NULL,
			location TEXT NOT NULL,
			date TEXT NOT NULL,
			summary TEXT,
			status TEXT,
			source_url TEXT,
			source_name TEXT,
			last_update TEXT,
			nation TEXT DEFAULT 'us',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS mystery_briefings (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			body_md TEXT NOT NULL,
			sources_json TEXT,
			nation TEXT DEFAULT 'us',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS mystery_insights (
			id TEXT PRIMARY KEY,
			author_name TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			category TEXT,
			fact_check_status TEXT NOT NULL,
			fact_check_notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS investigation_notes (
			id TEXT PRIMARY KEY,
			case_id TEXT NOT NULL,
			author_name TEXT NOT NULL,
			title TEXT NOT NULL,
			body TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_investigation_notes_case_id ON investigation_notes(case_id)`,
		`CREATE TABLE IF NOT EXISTS investigation_nodes (
			id TEXT PRIMARY KEY,
			case_id TEXT NOT NULL,
			author_name TEXT NOT NULL,
			place TEXT,
			location TEXT,
			person_name TEXT,
			event_time TEXT NOT NULL,
			event TEXT NOT NULL,
			analysis TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_investigation_nodes_case_time ON investigation_nodes(case_id, event_time)`,
		`CREATE TABLE IF NOT EXISTS investigation_helper_sessions (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			title TEXT NOT NULL,
			summary TEXT,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_inv_helper_sessions_user ON investigation_helper_sessions(user_id, updated_at)`,
		`CREATE TABLE IF NOT EXISTS investigation_helper_messages (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			role TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (session_id) REFERENCES investigation_helper_sessions(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_inv_helper_messages_session ON investigation_helper_messages(session_id, created_at)`,
		`CREATE TABLE IF NOT EXISTS investigation_helper_files (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			filename TEXT NOT NULL,
			mime_type TEXT,
			size_bytes INTEGER DEFAULT 0,
			storage_path TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (session_id) REFERENCES investigation_helper_sessions(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_inv_helper_files_session ON investigation_helper_files(session_id)`,
		`CREATE TABLE IF NOT EXISTS fleet_markers (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			city_id TEXT NOT NULL,
			kind TEXT NOT NULL,
			name TEXT NOT NULL,
			lat REAL NOT NULL,
			lng REAL NOT NULL,
			address TEXT,
			notes TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_fleet_markers_user_city ON fleet_markers(user_id, city_id)`,
		`CREATE TABLE IF NOT EXISTS hard_data (
			id TEXT PRIMARY KEY,
			topic TEXT NOT NULL,
			payload TEXT NOT NULL,
			source TEXT NOT NULL,
			received_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_hard_data_received_at ON hard_data(received_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_hard_data_topic ON hard_data(topic)`,
		`CREATE TABLE IF NOT EXISTS hardware_registry (
			id TEXT PRIMARY KEY,
			serial TEXT NOT NULL UNIQUE,
			topic TEXT NOT NULL UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}

	migrateNationColumns(db)
	return nil
}

func migrateNationColumns(db *sql.DB) {
	alters := []string{
		`ALTER TABLE users ADD COLUMN nation TEXT DEFAULT 'us'`,
		`ALTER TABLE mystery_cases ADD COLUMN nation TEXT DEFAULT 'us'`,
		`ALTER TABLE mystery_briefings ADD COLUMN nation TEXT DEFAULT 'us'`,
	}
	for _, q := range alters {
		if _, err := db.Exec(q); err != nil {
			// Column already exists on upgraded DBs.
			_ = err
		}
	}
}

// clearExampleCases removes seeded demo cases (case-001 … case-010) so the
// investigation Cases desk is empty until the officer creates their own.
func clearExampleCases(db *sql.DB) error {
	ids := []string{
		"case-001", "case-002", "case-003", "case-004", "case-005",
		"case-006", "case-007", "case-008", "case-009", "case-010",
	}
	for _, id := range ids {
		if _, err := db.Exec(`DELETE FROM investigation_nodes WHERE case_id = ?`, id); err != nil {
			return err
		}
		if _, err := db.Exec(`DELETE FROM investigation_notes WHERE case_id = ?`, id); err != nil {
			// table may not exist on very old DBs — ignore
			_ = err
		}
		if _, err := db.Exec(`DELETE FROM cases WHERE id = ?`, id); err != nil {
			return err
		}
	}
	return nil
}

