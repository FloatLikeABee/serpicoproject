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
	// Create data directory if it doesn't exist
	dataDir := "data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	// Initialize SQLite
	sqlitePath := filepath.Join(dataDir, "serpico.db")
	db, err := sql.Open("sqlite3", sqlitePath)
	if err != nil {
		return nil, err
	}

	// Create tables
	if err := createTables(db); err != nil {
		return nil, err
	}

	// Seed database with mock data
	if err := SeedDatabase(db); err != nil {
		log.Printf("Warning: Failed to seed database: %v", err)
	}

	// Initialize BadgerDB for caching
	badgerPath := filepath.Join(dataDir, "cache")
	badgerDB, err := badger.Open(badger.DefaultOptions(badgerPath))
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
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			return err
		}
	}

	return nil
}

