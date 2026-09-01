package database

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInitializeCreatesHardDataTable(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DATA_DIR", dir)
	db, err := Initialize()
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	defer db.Close()

	var name string
	err = db.SQLite.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='hard_data'`,
	).Scan(&name)
	if err != nil {
		t.Fatalf("hard_data table missing: %v", err)
	}
	if name != "hard_data" {
		t.Fatalf("got table %q", name)
	}
	if _, err := os.Stat(filepath.Join(dir, "serpico.db")); err != nil {
		t.Fatalf("sqlite file: %v", err)
	}
}

func TestInsertAndListHardDataOrder(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	first, err := InsertHardData(db.SQLite, "serpico/hard-data/a", "alpha", HardDataSourceHTTP)
	if err != nil {
		t.Fatal(err)
	}
	second, err := InsertHardData(db.SQLite, "serpico/hard-data/b", "beta", HardDataSourceMQTT)
	if err != nil {
		t.Fatal(err)
	}

	list, err := ListHardData(db.SQLite, 50)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 2 {
		t.Fatalf("want 2, got %d", len(list))
	}
	if list[0].ID != second.ID || list[1].ID != first.ID {
		t.Fatalf("want newest first, got %+v", list)
	}
	if list[0].Payload != "beta" || list[1].Payload != "alpha" {
		t.Fatalf("payloads rewritten: %+v", list)
	}
}

func TestInsertHardDataRejectsOversizeAndEmpty(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if _, err := InsertHardData(db.SQLite, "t", "", HardDataSourceHTTP); err != ErrHardDataEmpty {
		t.Fatalf("empty: %v", err)
	}
	big := strings.Repeat("x", HardDataMaxPayload+1)
	if _, err := InsertHardData(db.SQLite, "t", big, HardDataSourceHTTP); err != ErrHardDataTooLarge {
		t.Fatalf("oversize: %v", err)
	}
	if _, err := InsertHardData(db.SQLite, "t", "ok", "ai"); err != ErrHardDataSource {
		t.Fatalf("bad source: %v", err)
	}
}
