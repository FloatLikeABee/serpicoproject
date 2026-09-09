package database

import (
	"testing"
)

func TestInitializeCreatesInvitesTableAndPasswordHash(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DATA_DIR", dir)
	db, err := Initialize()
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	defer db.Close()

	var name string
	if err := db.SQLite.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='invites'`,
	).Scan(&name); err != nil {
		t.Fatalf("invites table missing: %v", err)
	}
	if name != "invites" {
		t.Fatalf("got table %q", name)
	}

	rows, err := db.SQLite.Query(`PRAGMA table_info(users)`)
	if err != nil {
		t.Fatalf("pragma: %v", err)
	}
	defer rows.Close()
	found := false
	for rows.Next() {
		var cid int
		var colName, colType string
		var notnull, pk int
		var dflt interface{}
		if err := rows.Scan(&cid, &colName, &colType, &notnull, &dflt, &pk); err != nil {
			t.Fatal(err)
		}
		if colName == "password_hash" {
			found = true
		}
	}
	if !found {
		t.Fatal("users.password_hash column missing")
	}
}

func TestOpenSQLiteCreatesInvitesTable(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var name string
	if err := db.SQLite.QueryRow(
		`SELECT name FROM sqlite_master WHERE type='table' AND name='invites'`,
	).Scan(&name); err != nil {
		t.Fatalf("table: %v", err)
	}
}

func TestInviteGeneratorsLengthUniquenessAndNotSerpico(t *testing.T) {
	c1, err := GenerateInviteCode()
	if err != nil {
		t.Fatal(err)
	}
	c2, err := GenerateInviteCode()
	if err != nil {
		t.Fatal(err)
	}
	if len(c1) < 32 {
		t.Fatalf("code too short: %q", c1)
	}
	if c1 == c2 {
		t.Fatal("codes not unique")
	}

	u1, err := GenerateInviteUsername()
	if err != nil {
		t.Fatal(err)
	}
	u2, err := GenerateInviteUsername()
	if err != nil {
		t.Fatal(err)
	}
	if u1 == "serpico" || u2 == "serpico" {
		t.Fatal("username collided with serpico")
	}
	if len(u1) < 5 || u1[:3] != "off" {
		t.Fatalf("username prefix: %q", u1)
	}
	if u1 == u2 {
		t.Fatal("usernames not unique")
	}

	p1, err := GenerateInvitePassword()
	if err != nil {
		t.Fatal(err)
	}
	p2, err := GenerateInvitePassword()
	if err != nil {
		t.Fatal(err)
	}
	if len(p1) != 16 {
		t.Fatalf("password length %d", len(p1))
	}
	if p1 == p2 {
		t.Fatal("passwords not unique")
	}
}
