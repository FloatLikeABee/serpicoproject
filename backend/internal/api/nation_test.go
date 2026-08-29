package api

import (
	"database/sql"
	"strings"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestParseNation(t *testing.T) {
	if ParseNation("") != "us" {
		t.Fatal("empty should be us")
	}
	if ParseNation("cn") != "cn" {
		t.Fatal("cn")
	}
	if ParseNation("China") != "cn" {
		t.Fatal("China")
	}
	if ParseNation("zh-CN") != "cn" {
		t.Fatal("zh-CN")
	}
}

func TestReplyLanguageInstruction(t *testing.T) {
	cn := ReplyLanguageInstruction("cn")
	if !strings.Contains(cn, "简体中文") {
		t.Fatalf("cn instruction missing 简体中文: %s", cn)
	}
	us := ReplyLanguageInstruction("us")
	if strings.Contains(us, "简体中文") {
		t.Fatalf("us should stay English: %s", us)
	}
}

func TestUpsertUserNationKeepsCNAfterReload(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE users (
		id TEXT PRIMARY KEY,
		email TEXT UNIQUE NOT NULL,
		name TEXT NOT NULL,
		role TEXT NOT NULL,
		rank TEXT,
		nation TEXT DEFAULT 'us'
	)`); err != nil {
		t.Fatal(err)
	}
	if err := UpsertUserNation(db, "demo-serpico", "cn"); err != nil {
		t.Fatal(err)
	}
	got, err := GetUserNation(db, "demo-serpico")
	if err != nil {
		t.Fatal(err)
	}
	if got != "cn" {
		t.Fatalf("expected cn after reload, got %s", got)
	}
	other, err := GetUserNation(db, "officer-b")
	if err != nil {
		t.Fatal(err)
	}
	if other != "us" {
		t.Fatalf("other id should default us, got %s", other)
	}
}
