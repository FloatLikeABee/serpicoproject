package database

import (
	"testing"
	"time"
)

func TestInitializeCreatesLalemFeedTables(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DATA_DIR", dir)
	db, err := Initialize()
	if err != nil {
		t.Fatalf("Initialize: %v", err)
	}
	defer db.Close()

	for _, table := range []string{"lalem_trends", "lalem_useful", "lalem_feed_meta"} {
		var name string
		err = db.SQLite.QueryRow(
			`SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
			table,
		).Scan(&name)
		if err != nil {
			t.Fatalf("%s table missing: %v", table, err)
		}
		if name != table {
			t.Fatalf("got table %q want %q", name, table)
		}
	}
}

func TestOpenSQLiteCreatesLalemFeedTables(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, table := range []string{"lalem_trends", "lalem_useful", "lalem_feed_meta"} {
		var name string
		if err := db.SQLite.QueryRow(
			`SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
			table,
		).Scan(&name); err != nil {
			t.Fatalf("%s table: %v", table, err)
		}
	}
}

func TestLalemFeedListNewestFirstSkipsDuplicatesAndKeepsLocalesApart(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	older := time.Date(2026, 9, 10, 8, 0, 0, 0, time.UTC)
	newer := time.Date(2026, 9, 16, 8, 0, 0, 0, time.UTC)
	if err := InsertLalemTrend(db.SQLite, LalemTrendRow{
		Locale: "cn", Kind: "entertainment", Title: "昨日综艺", Hook: "昨天", ImageURL: "/lalem/trends/entertainment-1.svg", CreatedAt: older,
	}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemTrend(db.SQLite, LalemTrendRow{
		Locale: "cn", Kind: "fashion", Title: "今日口红", Hook: "今天", ImageURL: "/lalem/trends/fashion-1.svg", CreatedAt: newer,
	}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemTrend(db.SQLite, LalemTrendRow{
		Locale: "cn", Kind: "fashion", Title: "今日口红", Hook: "重复", ImageURL: "/lalem/trends/fashion-2.svg", CreatedAt: newer.Add(time.Hour),
	}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemTrend(db.SQLite, LalemTrendRow{
		Locale: "en", Kind: "entertainment", Title: "English only", Hook: "en", ImageURL: "/lalem/trends/entertainment-2.svg", CreatedAt: newer,
	}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemUseful(db.SQLite, LalemUsefulRow{Locale: "cn", Body: "别蹲太久", CreatedAt: older}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemUseful(db.SQLite, LalemUsefulRow{Locale: "cn", Body: "洗手", CreatedAt: newer}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemUseful(db.SQLite, LalemUsefulRow{Locale: "cn", Body: "洗手", CreatedAt: newer.Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemUseful(db.SQLite, LalemUsefulRow{Locale: "en", Body: "Wash hands", CreatedAt: newer}); err != nil {
		t.Fatal(err)
	}

	trends, err := ListLalemTrends(db.SQLite, "cn")
	if err != nil {
		t.Fatal(err)
	}
	if len(trends) != 2 {
		t.Fatalf("cn trends=%d want 2 (dup skipped)", len(trends))
	}
	if trends[0].Title != "今日口红" || trends[1].Title != "昨日综艺" {
		t.Fatalf("newest-first %+v", titles(trends))
	}
	enTrends, err := ListLalemTrends(db.SQLite, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(enTrends) != 1 || enTrends[0].Title != "English only" {
		t.Fatalf("en trends mixed: %+v", enTrends)
	}

	useful, err := ListLalemUseful(db.SQLite, "cn")
	if err != nil {
		t.Fatal(err)
	}
	if len(useful) != 2 {
		t.Fatalf("cn useful=%d want 2", len(useful))
	}
	if useful[0].Body != "洗手" || useful[1].Body != "别蹲太久" {
		t.Fatalf("useful order %+v", useful)
	}
	enUseful, err := ListLalemUseful(db.SQLite, "en")
	if err != nil {
		t.Fatal(err)
	}
	if len(enUseful) != 1 || enUseful[0].Body != "Wash hands" {
		t.Fatalf("en useful mixed: %+v", enUseful)
	}
}

func TestLalemFeedPruneOlderThanThreeCalendarMonths(t *testing.T) {
	db, err := OpenSQLite(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	shanghai, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 9, 16, 12, 0, 0, 0, shanghai)
	old := now.AddDate(0, -4, 0)
	keep := now.AddDate(0, -1, 0)
	if err := InsertLalemTrend(db.SQLite, LalemTrendRow{
		Locale: "cn", Kind: "entertainment", Title: "过期热搜", ImageURL: "/lalem/trends/entertainment-1.svg", CreatedAt: old,
	}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemTrend(db.SQLite, LalemTrendRow{
		Locale: "cn", Kind: "fashion", Title: "还在热", ImageURL: "/lalem/trends/fashion-1.svg", CreatedAt: keep,
	}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemUseful(db.SQLite, LalemUsefulRow{Locale: "cn", Body: "过期贴士", CreatedAt: old}); err != nil {
		t.Fatal(err)
	}
	if err := InsertLalemUseful(db.SQLite, LalemUsefulRow{Locale: "cn", Body: "还在有用", CreatedAt: keep}); err != nil {
		t.Fatal(err)
	}

	if err := PruneLalemFeed(db.SQLite, now); err != nil {
		t.Fatal(err)
	}
	trends, err := ListLalemTrends(db.SQLite, "cn")
	if err != nil {
		t.Fatal(err)
	}
	if len(trends) != 1 || trends[0].Title != "还在热" {
		t.Fatalf("pruned trends %+v", titles(trends))
	}
	useful, err := ListLalemUseful(db.SQLite, "cn")
	if err != nil {
		t.Fatal(err)
	}
	if len(useful) != 1 || useful[0].Body != "还在有用" {
		t.Fatalf("pruned useful %+v", useful)
	}
}

func titles(rows []LalemTrendRow) []string {
	out := make([]string, len(rows))
	for i, r := range rows {
		out[i] = r.Title
	}
	return out
}
